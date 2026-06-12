"use client";

import { useEffect, useRef } from "react";
import type { TranscriptChunk } from "@/types";

interface TranscriptPaneProps {
  transcript: TranscriptChunk[];
  latestText: string | null;
}

export function TranscriptPane({ transcript, latestText }: TranscriptPaneProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length, latestText]);

  return (
    <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2">
      {transcript.map((chunk) => (
        <p key={chunk.chunk_id} className="text-gray-300 leading-relaxed">
          {chunk.text}
        </p>
      ))}
      {latestText && (
        <p className="text-brand-500 leading-relaxed animate-pulse">{latestText}</p>
      )}
      {transcript.length === 0 && !latestText && (
        <p className="text-gray-600 italic">Waiting for speech…</p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
