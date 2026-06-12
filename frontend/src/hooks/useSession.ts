"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/store";
import type { SessionStateUpdate } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export function useSession(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { updateFromStateEvent } = useAppStore();

  const connect = useCallback(() => {
    // Cancel a pending deferred disconnect from a Strict Mode unmount.
    if (disconnectTimer.current) {
      clearTimeout(disconnectTimer.current);
      disconnectTimer.current = null;
    }
    if (!sessionId || wsRef.current) return;

    const ws = new WebSocket(`${WS_BASE}/api/v1/ws/${sessionId}`);

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as SessionStateUpdate;
        // Only act on aggregated state messages; ignore anything without a session_id.
        if (data && typeof data.session_id === "string") {
          updateFromStateEvent(data);
        }
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      // Only clear the ref if this socket is still the active one — a stale
      // socket's late close must not null out a newer connection.
      if (wsRef.current === ws) wsRef.current = null;
    };

    wsRef.current = ws;
  }, [sessionId, updateFromStateEvent]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const sendAudio = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(buffer);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      // Defer teardown by a tick. React Strict Mode (dev) mounts → unmounts →
      // remounts synchronously; the remount's connect() clears this timer, so a
      // single WebSocket survives instead of a close/reopen churn that strands
      // audio frames. In production (no double mount) the timer fires and closes.
      disconnectTimer.current = setTimeout(() => {
        disconnect();
        disconnectTimer.current = null;
      }, 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { sendAudio, disconnect };
}
