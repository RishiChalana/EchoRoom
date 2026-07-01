# EchoRoom

[![Backend Tests](https://github.com/RishiChalana/EchoRoom/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/RishiChalana/EchoRoom/actions/workflows/backend-tests.yml)
[![Frontend Build](https://github.com/RishiChalana/EchoRoom/actions/workflows/frontend-build.yml/badge.svg)](https://github.com/RishiChalana/EchoRoom/actions/workflows/frontend-build.yml)

EchoRoom is a real-time AI communication coaching platform that transcribes your speech, analyzes engagement as you talk, and delivers a structured coaching report with precision rewrite suggestions when you finish.

## Live Demo

**[echo-room-ten.vercel.app](https://echo-room-ten.vercel.app)**
Sign in with Google or create an account to try it.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Next.js)                                       │
│  MediaRecorder → WebM/Opus chunks                        │
└──────────────────┬───────────────────────────────────────┘
                   │ WebSocket (binary audio frames)
                   ▼
┌──────────────────────────────────────────────────────────┐
│  FastAPI  (WebSocket ingest + REST API)                  │
│  stream.py accumulates audio → Redis audio:{id}          │
└──────┬───────────────────────────────┬───────────────────┘
       │ Celery task (local queue)     │ Redis pub/sub state:{id}
       ▼                               ▼
┌─────────────────────┐   ┌────────────────────────────────┐
│  Celery Worker      │   │  OrchestratorAgent             │
│  TranscriptAgent    │   │  subscribes transcript:{id}    │
│  faster-whisper     │   │  + engagement:{id}             │
│  (tiny.en, int8)    │   │  aggregates → state:{id}       │
│        │            │   │  → WebSocket → Browser         │
│        ▼            │   └────────────────────────────────┘
│  EngagementAgent    │
│  heuristic <50ms    │──► Redis: transcript:{id}
│                     │──► Redis: engagement:{id}
└─────────────────────┘

── On "End Session" ──────────────────────────────────────────

FastAPI signals Celery coach queue
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  Celery Coach Worker  (LangGraph pipeline)               │
│                                                          │
│  ClarityAgent ──────────────────► Gemini 2.5 Flash       │
│  (one batched call, full transcript)                     │
│                                                          │
│  CoachAgent (LangGraph):                                 │
│    fetch_events                                          │
│      → segment_analyzer ───────► Gemini 2.5 Flash       │
│      → insight_synthesizer ────► Gemini 2.5 Flash       │
│      → rewrite_generator ──────► Gemini 2.5 Flash       │
│      → save_report                                       │
│          ├─ reads audio from Redis audio:{id}            │
│          └─► PostgreSQL  session_reports                 │
└──────────────────────────────────────────────────────────┘

All services: PostgreSQL (sessions, agent_events, reports, users)
              Redis (Celery broker + agent pub/sub + report cache)
```

## Tech Stack

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| API Framework | FastAPI + Gunicorn/Uvicorn | Async REST + WebSocket |
| Speech-to-Text | faster-whisper (Whisper tiny.en) | Real-time transcription |
| LLM | Gemini 2.5 Flash | Coaching analysis + rewrites |
| Agent Orchestration | LangGraph | Stateful coaching pipeline |
| Structured Output | instructor | Type-safe LLM responses |
| Task Queue | Celery 5.4 | Async transcription + coaching workers |
| Message Broker | Redis 7 | Celery broker + agent pub/sub + report cache |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 | Sessions, reports, users |
| Migrations | Alembic | Schema versioning |
| Auth | NextAuth.js + bcrypt | OAuth + email/password |
| Monitoring | Sentry | Error tracking |
| Rate Limiting | slowapi + Redis | Per-user request limits |
| Testing | pytest + pytest-asyncio | 64 tests, real DB |

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR + client components |
| Language | TypeScript (strict) | Type safety throughout |
| Styling | Tailwind CSS + CSS variables | Design token system |
| State | Zustand | Session + transcript state |
| Charts | Recharts | Engagement timeline + dashboard |
| Auth | NextAuth.js | Google OAuth + credentials |
| Error | Sentry | Client-side error capture |
| 3D | Three.js | Landing page sphere (lazy-loaded) |

## AI Pipeline

1. User speaks → browser MediaRecorder captures WebM/Opus audio in 250ms chunks
2. Chunks stream via WebSocket → FastAPI accumulates raw audio and publishes to Redis `transcript:{session_id}`
3. Celery Worker subscribes → faster-whisper transcribes each chunk → publishes text + engagement scores to Redis
4. OrchestratorAgent aggregates rolling state → pushes live updates to browser over the same WebSocket
5. Session ends → Celery Coach Worker dispatches:
   - **ClarityAgent**: ONE batched Gemini call on full transcript → vocabulary/structure/conciseness scores
   - **CoachAgent** (LangGraph): segment analysis → insight synthesis → precision rewrites → saved to PostgreSQL
6. Report page polls every 3s until `report_ready` → displays score/100, engagement timeline, insights, precision edits, and audio playback

## Features

| Feature | Status | Notes |
|---|---|---|
| Real-time transcription | ✅ Live | faster-whisper tiny.en |
| Engagement scoring | ✅ Live | Heuristic (filler ratio + TTR) |
| Room-aware coaching | ✅ Live | Technical / Interview / Presentation / General |
| Precision edit suggestions | ✅ Live | Gemini rewrites |
| Session audio playback | ✅ Live | Stored as WebM in PostgreSQL |
| Session sharing | ✅ Live | Public/private toggle per report |
| Google OAuth | ✅ Live | NextAuth.js |
| Email/password auth | ✅ Live | bcrypt |
| WebSocket reconnection | ✅ Live | Exponential backoff, audio buffering |
| Report caching | ✅ Live | Redis, 1-hour TTL |
| Rate limiting | ✅ Live | Redis-backed, per-user |
| Error monitoring | ✅ Live | Sentry (backend + frontend) |
| CI/CD | ✅ Live | GitHub Actions (backend tests + frontend build) |
| Real-time WPM | ✅ Live | Updates every transcript chunk |

## Local Development

**Prerequisites:**
- Docker + Docker Compose
- Node.js 20+
- Python 3.12
- A Google AI Studio API key (for Gemini)
- Google OAuth credentials (optional — email/password works without)

**1. Clone and configure environment:**

```bash
git clone https://github.com/RishiChalana/EchoRoom.git
cd EchoRoom
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

**2. Start backend services:**

```bash
docker compose up -d
```

This starts: PostgreSQL, Redis, FastAPI API, Celery worker (transcription), Celery coach worker (LangGraph).

**3. Start frontend:**

```bash
cd frontend
npm install
# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXTAUTH_SECRET=$(openssl rand -hex 32)
# NEXTAUTH_URL=http://localhost:3000
npm run dev
```

**4. Open http://localhost:3000**

**Running tests:**

```bash
# Create test database (first time only)
docker compose exec postgres psql -U echoroom -c \
  "CREATE DATABASE echoroom_test;"

cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -v
```

Output: 64 passed in ~4s

## Project Structure

```
EchoRoom/
├── backend/
│   ├── app/
│   │   ├── agents/          # AI pipeline agents
│   │   │   ├── transcript_agent.py   # faster-whisper
│   │   │   ├── engagement_agent.py   # heuristic scorer
│   │   │   ├── clarity_agent.py      # Gemini clarity
│   │   │   ├── coach_agent.py        # LangGraph pipeline
│   │   │   └── orchestrator_agent.py # WebSocket relay
│   │   ├── api/v1/          # FastAPI routes
│   │   ├── models/          # SQLAlchemy models
│   │   ├── workers/         # Celery configuration
│   │   └── core/            # Config, auth, Redis, DB
│   ├── tests/               # 64 pytest tests
│   └── alembic/             # Database migrations
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # Shared UI components
│   │   ├── hooks/           # useSession, useSessionSocket
│   │   └── lib/             # API client, auth helpers
│   └── sentry.*.config.ts   # Error monitoring
└── .github/workflows/       # CI/CD pipelines
```

## Deployment

Frontend deployed on Vercel (automatic deploys from main branch). Backend (API + 2 Celery workers + PostgreSQL + Redis) deployed on Railway with service-level environment variable isolation.

### Environment Variables

| Variable | Service | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | Railway API + Workers | Yes | PostgreSQL connection string |
| `REDIS_URL` | Railway API + Workers | Yes | Redis connection string |
| `SECRET_KEY` | Railway API | Yes | FastAPI signing secret |
| `GEMINI_API_KEY` | Railway API + Coach Worker | Yes | Google AI Studio key |
| `NEXTAUTH_SECRET` | Railway API | Yes | Must match Vercel value |
| `CORS_ORIGINS` | Railway API | Yes | JSON array of allowed origins |
| `SENTRY_DSN` | Railway all services | No | Error monitoring |
| `ENVIRONMENT` | Railway all services | Yes | Set to `production` |
| `RUN_MIGRATIONS` | Railway API | Yes | Set to `true` on api, `false` on workers |
| `NEXTAUTH_URL` | Vercel | Yes | Canonical frontend URL |
| `NEXT_PUBLIC_API_URL` | Vercel | Yes | Public Railway API URL |
| `NEXTAUTH_SECRET` | Vercel | Yes | Must match Railway value |
| `GOOGLE_CLIENT_ID` | Vercel | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Vercel | No | Google OAuth |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | No | Client-side error monitoring |

## Architecture Decisions

**Append-only event log**
All agent events (transcript chunks, engagement scores) are written to `agent_events` as immutable rows — never updated or deleted. This creates a complete audit trail for every session and lets the coach pipeline reconstruct full session history independently of any other state.

**Batched LLM calls**
The clarity agent makes ONE Gemini API call at session end with the full transcript, not one call per audio chunk. This avoids 429 rate limit storms and reduces cost by ~95% compared to per-chunk analysis.

**Redis pub/sub for agent communication**
Agents communicate exclusively via Redis channels, never via direct function calls or shared memory. This means the transcription worker, engagement scorer, and WebSocket relay can scale independently and the system degrades gracefully if any single agent is slow.

**Heuristic fallbacks on every LLM node**
Every node in the LangGraph coaching pipeline has a deterministic fallback — if Gemini fails, the report still saves with heuristic-derived scores. This means a session report is always generated, even during API outages.

**Redis-backed rate limiting**
Rate limit counters are stored in Redis rather than in memory, so all Gunicorn worker processes share the same counters. This prevents the multi-worker counter isolation bug where requests spread across workers would never collectively trigger a limit.
