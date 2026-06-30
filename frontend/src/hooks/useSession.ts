"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store";
import { apiFetch } from "@/lib/utils";
import type { SessionStateUpdate, TranscriptRecoveryResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

const MAX_RECONNECT_ATTEMPTS = 10;

// Each MediaRecorder chunk is 250 ms (recorder.start(250)). 240 × 250 ms = 60 s max buffer.
const MAX_BUFFER_CHUNKS = 240;

export function useSession(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isIntentionalDisconnect = useRef(false);
  // Stable ref to doConnect so retryConnection can call it from outside the effect.
  const doConnectRef = useRef<(() => void) | null>(null);

  // ── Audio buffering during disconnect ─────────────────────────────────────
  // Each MediaRecorder chunk is 250 ms of audio. We buffer up to MAX_BUFFER_CHUNKS
  // (60 s) while the WebSocket is down and flush them in order on reconnect.
  // Beyond the cap, chunks are dropped and bufferOverflowedRef is set so the UI
  // can warn the user of a potential gap.
  //
  // The EBML/WebM header (the very first chunk from a MediaRecorder session) is
  // stored separately in webmHeaderRef. The backend's stream handler expects the
  // header as the first chunk on each new WS connection; we prepend it before
  // flushing so it can assemble valid WebM blobs. If webmHeaderRef is null
  // (the connection was down before any audio was ever sent), the first item in
  // audioBuffer IS the EBML header, so we send the buffer as-is.
  const webmHeaderRef = useRef<ArrayBuffer | null>(null);
  const audioBuffer = useRef<ArrayBuffer[]>([]);
  const bufferOverflowedRef = useRef(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [showGapWarning, setShowGapWarning] = useState(false);

  const { updateFromStateEvent, recoverTranscriptHistory } = useAppStore();

  useEffect(() => {
    // Reset flags on each mount (handles React Strict Mode's double-mount).
    isIntentionalDisconnect.current = false;
    reconnectAttempts.current = 0;
    webmHeaderRef.current = null;
    audioBuffer.current = [];
    bufferOverflowedRef.current = false;

    function scheduleReconnect() {
      if (isIntentionalDisconnect.current) return;

      reconnectAttempts.current += 1;

      if (reconnectAttempts.current > MAX_RECONNECT_ATTEMPTS) {
        setConnectionState("failed");
        return;
      }

      setConnectionState("reconnecting");

      // Backoff: 1s, 2s, 4s, 8s, 16s, cap at 30s
      const delay = Math.min(
        Math.pow(2, reconnectAttempts.current - 1) * 1000,
        30_000,
      );

      backoffTimer.current = setTimeout(() => {
        backoffTimer.current = null;
        doConnect();
      }, delay);
    }

    function doConnect() {
      // Cancel a pending deferred disconnect from a Strict Mode unmount.
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current);
        disconnectTimer.current = null;
      }

      if (!sessionId || wsRef.current) return;

      setConnectionState("connecting");

      const ws = new WebSocket(`${WS_BASE}/api/v1/ws/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const wasReconnect = reconnectAttempts.current > 0;
        reconnectAttempts.current = 0;
        setConnectionState("connected");

        if (wasReconnect) {
          // Flush buffered audio in order BEFORE transcript recovery so the backend
          // processes the audio and publishes results before the frontend snapshots state.
          //
          // If we have the header from before the drop, prepend it so the backend's
          // _flush() can assemble a valid WebM blob: header_bytes + cluster_chunks.
          // If webmHeaderRef is null (WS was down before any audio was sent), the first
          // buffered chunk is itself the EBML header — send the buffer as-is.
          if (audioBuffer.current.length > 0) {
            if (webmHeaderRef.current !== null) {
              ws.send(webmHeaderRef.current);
            }
            for (const chunk of audioBuffer.current) {
              ws.send(chunk);
            }
            audioBuffer.current = [];
          }
          // Reset so the first live sendAudio on this new connection sets the header.
          webmHeaderRef.current = null;

          // If the buffer overflowed, warn the user that a gap may exist.
          if (bufferOverflowedRef.current) {
            setShowGapWarning(true);
            bufferOverflowedRef.current = false;
          }

          // Recover transcript snapshot from the backend — append any chunks
          // that arrived while we were disconnected.
          apiFetch<TranscriptRecoveryResponse>(
            `/api/v1/sessions/${sessionId}/transcript`,
          )
            .then((data) => recoverTranscriptHistory(data.transcript_chunks))
            .catch((err) =>
              console.error("[EchoRoom] Transcript recovery failed:", err),
            );
        }
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as SessionStateUpdate;
          if (data && typeof data.session_id === "string") {
            updateFromStateEvent(data);
          }
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onclose = () => {
        // Guard against stale sockets from retryConnection replacing the ref.
        // If wsRef no longer points to this socket, we've already moved on — skip.
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        if (!isIntentionalDisconnect.current) {
          setConnectionState("disconnected");
          scheduleReconnect();
        }
      };
    }

    doConnectRef.current = doConnect;
    doConnect();

    return () => {
      // Cancel any pending reconnect backoff.
      if (backoffTimer.current) {
        clearTimeout(backoffTimer.current);
        backoffTimer.current = null;
      }
      reconnectAttempts.current = 0;

      // Defer WS teardown by a tick. React Strict Mode (dev) mounts → unmounts →
      // remounts synchronously; the remount's doConnect() clears this timer so a
      // single WebSocket survives instead of a close/reopen cycle that drops frames.
      // In production (no double-mount) the timer fires and closes the socket.
      disconnectTimer.current = setTimeout(() => {
        isIntentionalDisconnect.current = true;
        wsRef.current?.close();
        wsRef.current = null;
        disconnectTimer.current = null;
      }, 100);
    };
    // updateFromStateEvent and recoverTranscriptHistory are Zustand actions —
    // stable across renders (created once inside the store). Intentionally omitted
    // from deps to avoid reconnecting on devtools/HMR store identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const sendAudio = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Track the first chunk sent on this WS connection — it is the EBML/WebM
      // header produced by MediaRecorder. We store it so we can prepend it on the
      // NEXT reconnect, giving the backend a valid header for each new connection.
      if (webmHeaderRef.current === null) {
        webmHeaderRef.current = buffer;
      }
      wsRef.current.send(buffer);
    } else {
      // WS is down — buffer instead of silently dropping.
      if (audioBuffer.current.length < MAX_BUFFER_CHUNKS) {
        audioBuffer.current.push(buffer);
      } else {
        // Cap reached; mark overflow so the UI can warn of a transcript gap.
        bufferOverflowedRef.current = true;
      }
    }
  }, []);

  // Call when the user stops/pauses recording. Clears the audio buffer so that
  // if they resume (new MediaRecorder session), chunks from two different WebM
  // streams aren't mixed in the same buffer — that would produce invalid audio.
  const resetAudioBuffer = useCallback(() => {
    audioBuffer.current = [];
    webmHeaderRef.current = null;
    bufferOverflowedRef.current = false;
  }, []);

  // Call this before programmatic session end so that the WS close that follows
  // navigation/unmount does NOT trigger a reconnect attempt.
  const markIntentionalDisconnect = useCallback(() => {
    isIntentionalDisconnect.current = true;
    if (backoffTimer.current) {
      clearTimeout(backoffTimer.current);
      backoffTimer.current = null;
    }
    audioBuffer.current = [];
    webmHeaderRef.current = null;
    bufferOverflowedRef.current = false;
    setShowGapWarning(false);
    wsRef.current?.close(1000, "Session ended");
    wsRef.current = null;
  }, []);

  // Manual retry after reaching "failed" state — resets the attempt counter.
  const retryConnection = useCallback(() => {
    if (isIntentionalDisconnect.current) return;
    reconnectAttempts.current = 0;
    // Close the current socket (if any) before reconnecting. Setting wsRef to null
    // first prevents the old socket's onclose from triggering scheduleReconnect again.
    const old = wsRef.current;
    wsRef.current = null;
    old?.close();
    doConnectRef.current?.();
  }, []);

  return {
    sendAudio,
    resetAudioBuffer,
    connectionState,
    // Current attempt count — stable to read at render time because
    // setConnectionState("reconnecting") triggers the re-render that reads this.
    reconnectCount: reconnectAttempts.current,
    showGapWarning,
    markIntentionalDisconnect,
    retryConnection,
  };
}
