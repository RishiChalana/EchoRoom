# EchoRoom — Architecture Overview

## System Design

EchoRoom processes speech in real-time through 10 specialized AI agents.
Agents communicate via Redis pub/sub. No direct function calls between agents.

## Agent Pipeline

```
[Browser — MediaRecorder]
        │ PCM audio frames
        ▼
[TranscriptAgent]          faster-whisper, VAD chunking, <300ms
        │ TranscriptChunk → Redis "transcript:{session_id}"
        │
   ┌────┴──────────────────────────────┐
   ▼                                   ▼
[EngagementClassifier]        [ClarityAnalyzerAgent]
  distilbert (local, <50ms)    GPT-4o-mini (~1.5s)
   │                                   │
   └─────────────┬─────────────────────┘
                 │
    [QuestionSynthesizer]  [RetentionPredictor]
       (every 3rd chunk)     (sliding window)
                 │                  │
                 └──────┬───────────┘
                        │
               [CriticAgent]
               (validates LLM outputs, NLI faithfulness)
                        │
               [OrchestratorAgent]
               (aggregates, debounces, conflict resolution)
                        │ SessionStateUpdate
               WebSocket → [Browser]
                        │
               [Session Audit Log] (append-only)
                        │
            (on session end)
                        ▼
               [CoachAgent]
               LangGraph pipeline → SessionReport → DB
                        │
               [MemoryAgent]
               cross-session embeddings → ChromaDB
```

## Data Flow

1. **Browser** captures audio via MediaRecorder API
2. **WebSocket** streams 500ms binary audio frames to API
3. **TranscriptAgent** runs faster-whisper, publishes TranscriptChunks to Redis
4. **EngagementClassifier** subscribes, runs local model, publishes EngagementSignal
5. **ClarityAnalyzer** subscribes, calls GPT-4o-mini, publishes ClarityAnalysis
6. **CriticAgent** validates LLM outputs before forwarding
7. **OrchestratorAgent** aggregates all signals, debounces, pushes to WebSocket
8. **Browser** renders real-time feedback (avatars, metrics, questions)
9. **CoachAgent** runs on session end — LangGraph pipeline → SessionReport

## Databases

| Store | Purpose | When |
|-------|---------|------|
| PostgreSQL | Sessions, agent_events audit log, reports | All |
| Redis | Pub/sub channels, Celery queue, session state | All |
| ChromaDB | Cross-session user embeddings | Week 9 |

## Why Multiple Agents?

Each agent has a fundamentally different computational profile:

- **EngagementClassifier:** Local C++ inference (< 50ms) — must not be coupled to LLM latency
- **ClarityAnalyzer + QuestionSynthesizer:** Can run in parallel on same chunk
- **CoachAgent:** Needs full session context — cannot run incrementally
- **EvaluatorAgent:** Must be isolated from the agents it measures
- **OrchestratorAgent:** Has timing/debouncing concerns that belong to no single analyzer

## Technology Choices

| Decision | Choice | Why |
|----------|--------|-----|
| Async framework | FastAPI + asyncpg | Best async Python DX, high performance |
| Agent communication | Redis pub/sub | Decouples agents, enables parallel processing |
| Task queue | Celery + Redis | Moves LLM calls off the async event loop |
| LLM structured output | instructor | Pydantic validation + automatic retry |
| Coaching pipeline | LangGraph | Conditional loops and state needed for self-correction |
| Frontend state | Zustand | Lightweight, TypeScript-first, WebSocket-friendly |

## Key Architectural Rules

See `ai/CLAUDE.md` for the full list of locked decisions.
Short version:
- No LLM calls in async endpoints (all via Celery)
- No direct agent-to-agent calls (all via Redis pub/sub)
- `agent_events` table is append-only
- LangGraph used ONLY in CoachAgent
