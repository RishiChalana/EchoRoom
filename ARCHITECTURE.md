# EchoRoom — Architecture

This document describes how EchoRoom is actually built. For the product overview and setup, see the [README](README.md).

## Overview

EchoRoom is an event-driven, multi-agent system. Five agents collaborate to turn live microphone audio into a real-time engagement signal and an end-of-session coaching report. Agents do **not** call each other directly — every cross-agent message flows through **Redis pub/sub**. This decouples them and, critically, lets the fast local engagement path run without ever blocking on slow LLM work.

Two execution surfaces:

- **FastAPI** owns the WebSocket connection and the REST API. It is async and stays responsive; it does no heavy compute itself.
- **Celery workers** do all heavy/blocking work — speech-to-text and LLM calls — off the async event loop.

## The agents

| Agent | Runs in | Cost profile | Output |
|---|---|---|---|
| `transcript_agent` | Celery (`local` queue) | faster-whisper, ~1–15s/chunk on CPU | `TranscriptChunk` |
| `engagement_agent` | Celery (`local` queue) | local heuristic, <50ms | `EngagementSignal` |
| `clarity_agent` | Celery (`coach` queue, at session end) | Gemini 2.5 Flash, one batched call | `ClarityAnalysis` |
| `orchestrator_agent` | FastAPI async task (per WebSocket) | in-memory aggregation | `SessionStateUpdate` |
| `coach_agent` | Celery (`coach` queue) | LangGraph + Gemini, on session end | `SessionReport` |

`engagement_agent` is intentionally **not** an LLM. It scores each chunk from cheap lexical features — filler-word ratio, type-token ratio (vocabulary variety), average word length, sentence count — and returns a 0–1 score plus a `low`/`medium`/`high` label. Being local and instant is the whole point: the live gauge must update without waiting on a network round-trip.

## Live pipeline (while speaking)

```
[Browser - MediaRecorder, 250ms WebM/Opus fragments]
        |
        |  WebSocket  /api/v1/ws/{session_id}
        v
[FastAPI stream.py]
  - buffers WebM fragments per session, keeping the header fragment
  - flushes ~3s (header + clusters) as one base64 blob
  - dispatches transcribe_chunk via Celery (asyncio.to_thread)
        |
        v
[transcript_agent]  (Celery: local queue)
  faster-whisper "base", decodes the WebM blob, VAD filtering
  -> publishes TranscriptChunk to  redis: transcript:{session_id}
  -> appends an "transcript" row to agent_events
  -> chains classify_engagement
        |
        v
[engagement_agent]  (Celery: local queue)
  local heuristic on the chunk text
  -> publishes EngagementSignal to  redis: engagement:{session_id}
  -> appends an "engagement_classifier" row to agent_events
        |
        v
[orchestrator_agent]  (FastAPI async task, started per WebSocket)
  subscribes to transcript:* and engagement:* for this session
  maintains running averages (in memory, per connection)
  -> publishes SessionStateUpdate to  redis: state:{session_id}
        |
        v
[FastAPI stream.py]  subscribes to ONLY state:* and report_ready:*
  -> forwards clean SessionStateUpdate frames over the WebSocket
        |
        v
[Browser]  updates the live engagement gauge + transcript
```

Why the API subscribes to only `state` and `report_ready`: the raw `transcript`/`engagement`/`clarity` channels carry different message shapes meant for the orchestrator. The browser only ever receives the single aggregated `SessionStateUpdate` shape, so the frontend never has to branch on message type.

## Coaching pipeline (on session end)

Ending a session dispatches `process_coach_session` to the `coach` queue. `coach_agent` is a **LangGraph** state machine — the one place in the system that uses LangGraph, because the coaching flow is a linear pipeline with shared accumulating state:

```
fetch_events
   - loads all agent_events for the session (append-only log)
   - computes engagement_avg from engagement_classifier rows
   - concatenates the full transcript and runs ONE batched
     clarity analysis (clarity_agent) -> clarity_avg + issues
        |
        v
segment_analyzer
   - LLM classifies transcript segments as strong / weak / critical
        |
        v
insight_synthesizer
   - LLM produces prioritized CoachInsights (strength/improvement/critical)
   - computes overall_score from engagement, clarity, and segment mix
        |
        v
rewrite_generator
   - LLM rewrites the weakest/critical segments (before -> after)
        |
        v
save_report
   - writes a SessionReport row to PostgreSQL
   - marks the session complete, publishes report_ready:{session_id}
        |
        v
      END
```

**Every LLM node has a deterministic fallback.** On any failure (rate limit, timeout, malformed output), the node logs `coach node fell back to heuristic` and produces a heuristic result from data already in the database. A catastrophic failure of the whole graph still writes a minimal report. The invariant is: **ending a session always produces a saved report.** The session is never left stuck in `processing`.

## Data model

**PostgreSQL** — three tables:

`sessions` — `status` (`active`/`processing`/`complete`), `audience_profile`, `duration_seconds`, `overall_score`, `ended_at`, `report_ready`.

`agent_events` — the **append-only audit log**. `event_id`, `session_id`, `chunk_id`, `agent_name`, `event_type`, `payload` (JSONB), `model_version`, `processing_time_ms`, `created_at`. Rows are only ever inserted — never updated or deleted. The coach reconstructs the whole session from this log, and the per-chunk engagement chart in the report is rendered directly from `engagement_classifier` rows ordered by `created_at`.

`session_reports` — `session_id`, `overall_score`, `engagement_avg`, `clarity_avg`, `insights` (JSONB), `rewrites` (JSONB), `summary`, `coach_model`.

**Redis** — three roles: pub/sub channels (`transcript:`, `engagement:`, `clarity:`, `state:`, `report_ready:`), the Celery broker, and transient live session state.

## Celery queues

| Queue | Worker service | Tasks |
|---|---|---|
| `local` | `worker` (concurrency 4) | `transcribe_chunk`, `classify_engagement` |
| `coach` | `worker_coach` (concurrency 1) | `process_coach_session` (which invokes clarity) |

Separating the queues keeps slow coach runs from starving the fast transcription/engagement path, and lets the two worker services scale independently.

## Key design decisions

These are the tradeoffs behind the structure above.

**LLM calls run in Celery, never in async endpoints.** A multi-second blocking LLM call inside a FastAPI handler would stall the event loop for every connected client. All LLM and STT work is offloaded to workers.

**Clarity is one batched call per session, not per chunk.** The original design called the LLM on every 3-second chunk, which on a constrained API produced a rate-limit storm and gave the model poor (fragmentary) context. Clarity now runs once over the full transcript at session end — fewer calls, better context, and the live path stays LLM-free.

**Workers use a sync DB engine; the API uses async.** asyncpg connections are bound to the event loop that created them. Celery's prefork model runs a fresh `asyncio` loop per task, so a pooled async connection from a prior task leaks into the next loop and crashes ("event loop is closed"). The workers therefore use a synchronous psycopg2 engine, which is not loop-bound. The async engine is reserved for the API.

**Structured LLM output via `instructor`.** Every LLM call returns a validated Pydantic model (`instructor` + `Mode.JSON`), with automatic retry on malformed output, so downstream code never parses raw model text.

**One service owns migrations.** The three backend services share an image. Running `alembic upgrade head` from each on startup raced on the `alembic_version` table; migrations are now gated to the `api` service, and the workers wait on its healthcheck.

## Locked architectural rules

The non-negotiable invariants are enforced in [`ai/CLAUDE.md`](ai/CLAUDE.md). In short: agent communication is Redis-pub/sub-only; LLM calls are Celery-only; `agent_events` is append-only; engagement is local-heuristic-only (never an LLM); LangGraph is used only in the coach; one WebSocket per session.

## Notes on scope

This is a working MVP. The engagement scorer is a lexical heuristic rather than a trained classifier — a deliberate choice for latency and zero-dependency local inference, and a clean seam for a future ML model. Transcription runs on CPU faster-whisper, which is not real-time at high concurrency but is fine for a single-speaker session. The system is designed so each of these can be upgraded behind its existing Redis interface without touching the rest of the pipeline.