"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Session } from "@/types";

interface SessionControlsProps {
  session: Session;
  onEnd: () => void;
  sendAudio: (buffer: ArrayBuffer) => void;
}

export function SessionControls({ session, onEnd, sendAudio }: SessionControlsProps) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        void e.data.arrayBuffer().then(sendAudio);
      }
    };

    recorder.start(250);
    recorderRef.current = recorder;
    setRecording(true);
  }, [sendAudio]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const handleEnd = useCallback(() => {
    stopRecording();
    onEnd();
  }, [stopRecording, onEnd]);

  return (
    <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
      <div>
        {recording ? (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-200 transition hover:bg-gray-600"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Pause
          </button>
        ) : (
          <button
            onClick={() => void startRecording()}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition hover:bg-brand-600"
          >
            <span className="h-2 w-2 rounded-full bg-white" />
            Record
          </button>
        )}
      </div>

      <button
        onClick={handleEnd}
        disabled={session.status !== "active"}
        className={cn(
          "rounded-lg px-4 py-2 text-sm transition",
          session.status === "active"
            ? "bg-red-600/80 text-white hover:bg-red-600"
            : "cursor-not-allowed bg-gray-800 text-gray-600"
        )}
      >
        End Session
      </button>
    </div>
  );
}
