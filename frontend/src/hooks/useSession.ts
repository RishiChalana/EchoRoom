"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/store";
import type { SessionStateUpdate } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export function useSession(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { updateFromStateEvent } = useAppStore();

  const connect = useCallback(() => {
    if (!sessionId || wsRef.current) return;

    const ws = new WebSocket(`${WS_BASE}/api/v1/ws/${sessionId}`);

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as SessionStateUpdate;
        updateFromStateEvent(data);
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
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
    return disconnect;
  }, [connect, disconnect]);

  return { sendAudio, disconnect };
}
