# EchoRoom

**Real-time AI communication coaching.** Speak into your mic and EchoRoom transcribes you live, tracks how engaging your delivery is as you talk, and generates an AI coaching report the moment you finish — with specific, evidence-backed feedback on what worked and what to fix.

Built for anyone who has to hold an audience: educators, founders pitching, sales reps, conference speakers. The problem it solves is simple — **you get no feedback while you're actually speaking, and only generic feedback afterward.** EchoRoom gives you a live engagement signal during the session and a concrete, per-segment coaching breakdown after it.

<p align="center">
  <img src="docs/images/report.png" alt="EchoRoom session report showing engagement and clarity scores, a live engagement chart, and AI coaching insights" width="800">
</p>

> The report above is real output. Note the engagement score (81%) and clarity score (20%) **disagreeing** — the speaker held attention but communicated unclearly. Surfacing that gap is the whole point, and the two scores come from completely different subsystems (a local heuristic vs. an LLM), so the disagreement is meaningful rather than noise.

---

## What it does

- **Live transcription** — streams mic audio over a WebSocket and transcribes it in near real-time with faster-whisper.
- **Live engagement tracking** — every transcript chunk is scored by a fast local heuristic and pushed to an on-screen gauge as you speak.
- **End-of-session AI coaching** — when you stop, a LangGraph agent reads the full session, analyzes clarity, classifies each segment, and produces a scored report with prioritized, evidence-backed insights and concrete rewrite suggestions.
- **Always produces a report** — the coaching pipeline degrades gracefully: if the LLM is unavailable or rate-limited, it falls back to deterministic heuristics so a useful report is *always* generated.

---

## Architecture

EchoRoom is an event-driven, multi-agent system. Agents never call each other directly — they communicate over **Redis pub/sub**, which decouples them and lets fast local work (engagement) run independently of slow network work (LLM calls).

```
[Browser - MediaRecorder]
        |  WebSocket: buffered WebM/Opus audio
        v
+---------------------------------------------------------+
|  FastAPI  (WebSocket ingest + REST API)                 |
+---------------------------------------------------------+
        |  audio chunk -> Celery (local queue)
        v
[transcript_agent]  faster-whisper (base), publishes -> redis: transcript:{id}
        |
        v  (chained)
[engagement_agent]  local heuristic, <50ms, publishes -> redis: engagement:{id}
        |
        v
[orchestrator_agent]  subscribes to transcript+engagement, aggregates running
                      averages, publishes a clean SessionStateUpdate ->
                      redis: state:{id}  ->  WebSocket  ->  Browser (live gauges)

   ----------------  on "End Session"  ----------------

[coach_agent]  Celery (coach queue) - a LangGraph pipeline:
      fetch_events -> segment_analyzer -> insight_synthesizer
                   -> rewrite_generator -> save_report
      - reads the append-only event log for the session
      - runs ONE batched clarity analysis over the whole transcript
      - writes a SessionReport to PostgreSQL, publishes report_ready:{id}
```

**Two databases, each for what it's good at:**

| Store | Role |
|---|---|
| **PostgreSQL** | Sessions, the append-only `agent_events` audit log, and final `session_reports`. |
| **Redis** | Agent pub/sub channels, the Celery broker, and live session state. |

**Six services** under Docker Compose: `postgres`, `redis`, `api`, `worker` (transcription + engagement), `worker_coach` (the coaching pipeline), and `frontend`.

---

## Engineering decisions

The parts of this project worth talking about are the tradeoffs, not the feature list.

**LLM calls never touch the async event loop.** FastAPI handles WebSocket and REST concurrency; every LLM and transcription call runs in a **Celery** worker instead. A multi-second blocking LLM call inside an async request handler would stall the event loop for every other connected client. Offloading to Celery keeps the API responsive under load.

**The coaching pipeline always produces a report.** Each LLM stage (segment analysis, insight synthesis, rewrites, clarity) is wrapped so that on *any* failure — rate limit, timeout, malformed output — it falls back to a deterministic heuristic built from data already in the database. A demo that shows a spinner-of-death when an external API hiccups is worse than no demo; this system degrades to a still-useful report instead of failing.

**Clarity is analyzed once per session, not per chunk.** The original design called the LLM on every 3-second transcript chunk. On a constrained free-tier API that produced a storm of rate-limit errors and added no value — fragmentary 3-second clips are poor context for judging clarity. The system was redesigned so clarity runs as a **single batched call over the full transcript** at session end: fewer calls, better context, no rate-limit storm. The live path now carries only the instant local engagement signal.

**The event log is append-only.** Every agent output is persisted to `agent_events` as an immutable row (never updated or deleted). The coach reconstructs the entire session from this log at report time, and the per-chunk engagement chart in the report is rendered directly from it — not fabricated from an average.

**Sync vs. async database access is deliberate.** The API uses an async (asyncpg) engine. The Celery workers use a **synchronous** (psycopg2) engine, because asyncpg connections are bound to the event loop that created them — and a Celery prefork worker runs a fresh `asyncio` loop per task, which would otherwise reuse a stale, loop-bound connection and crash. Matching the driver to the execution model fixed an intermittent "event loop is closed" failure.

**One service owns migrations.** All three backend services share an image and entrypoint. Running `alembic upgrade head` from each on startup caused a race on the `alembic_version` table. Migrations are now gated to the `api` service only; the workers wait on its healthcheck before starting.

---

## Tech stack

**Backend** — Python 3.11, FastAPI, PostgreSQL 16, Redis 7, SQLAlchemy 2.0 (async + sync engines), Alembic, Celery 5.4, structlog.

**AI** — faster-whisper (speech-to-text), Google Gemini 2.5 Flash (clarity + coaching, via the OpenAI-compatible endpoint), [instructor](https://github.com/jxnl/instructor) for validated structured LLM output, LangGraph for the coaching pipeline.

**Frontend** — Next.js 14, TypeScript (strict), Tailwind CSS, Zustand, Recharts.

**Infra** — Docker Compose (six services).

---

## Quickstart

**Prerequisites:** Docker + Docker Compose, and a [Google Gemini API key](https://aistudio.google.com) (free tier works).

```bash
# 1. Clone
git clone https://github.com/RishiChalana/EchoRoom.git
cd EchoRoom

# 2. Configure
cp .env.example .env
#   then add your key to .env:   GEMINI_API_KEY=your_key_here

# 3. Run
docker compose up --build
```

Then open **http://localhost:3000**, create a session, allow microphone access, and start speaking. End the session to generate your coaching report.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

> **Note on the LLM:** EchoRoom uses Gemini's free tier by default. Free-tier prompts may be used by Google for model training — fine for demo speech, but don't feed it anything sensitive. The coaching pipeline falls back to heuristics if the key is missing or rate-limited, so the app still runs without a key (with reduced insight quality).

---

## Project layout

```
backend/
  app/
    agents/        transcript, engagement, clarity, orchestrator, coach, _persist
    api/v1/        stream (WebSocket), sessions, reports, health
    workers/       celery_app, tasks
    models/        session, agent_event (append-only), session_report
    schemas/       pydantic models
    prompts/       coach + clarity system prompts
frontend/
  src/
    app/           session + report pages (Next.js App Router)
    components/    session UI (gauges, transcript) + report UI (chart, insights)
    hooks/         useSession (WebSocket lifecycle)
    store/         Zustand state
ai/CLAUDE.md       locked architectural rules
docker-compose.yml six services
```

---

## Status

EchoRoom is a complete, working MVP: live transcription, real-time engagement, resilient AI coaching reports, and a real per-session engagement timeline — all running locally under Docker. It is a portfolio project, not a hosted product.