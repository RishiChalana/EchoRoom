# EchoRoom — Final Project Report

---

## 1. Project Overview

EchoRoom is a real-time AI communication coaching platform. Users record themselves speaking in one of four practice contexts (Technical, Interview, Presentation, General) and receive live engagement feedback plus a full post-session coaching report. The report includes an overall score, engagement arc, clarity analysis, AI-generated insights, and rewritten versions of weak passages.

---

## 2. Architecture

```
Browser
  │
  ├─ HTTP  ──→  Next.js 14 (Vercel)  ──→  FastAPI (Railway)  ──→  PostgreSQL
  │                                              │
  └─ WS   ──────────────────────────────────────┘
                                                 │
                                         Redis (pub/sub + Celery broker)
                                                 │
                                     ┌───────────┴───────────┐
                                 Celery Worker            Celery Worker
                                  (local queue)           (coach queue)
                               transcribe_chunk        process_coach_session
                            classify_engagement        (LangGraph pipeline)
```

**Request flow (live session):**
1. Browser opens WebSocket to `/api/v1/ws/{session_id}`
2. FastAPI accepts WS, spawns `OrchestratorAgent` (aggregates signals → Redis `state:` channel)
3. Browser sends raw webm audio frames
4. Backend buffers to ~3s clips, dispatches `transcribe_chunk` Celery task (local queue)
5. `transcribe_chunk` → faster-whisper STT → publishes to Redis `transcript:{id}` → dispatches `classify_engagement`
6. `classify_engagement` → heuristic filler/TTR/word-length scoring → publishes to Redis `engagement:{id}`
7. Orchestrator aggregates → publishes `state:{id}` → forwarded to browser WS

**Report flow (post-session):**
1. User clicks "End Session" → PATCH `/sessions/{id}/end`
2. Backend dispatches `process_coach_session` Celery task (coach queue)
3. LangGraph pipeline: fetch_events → segment_analyzer → insight_synthesizer → rewrite_generator → save_report
4. Each node uses Gemini 2.5 Flash via OpenAI-compatible endpoint (instructor for structured output)
5. Clarity analysis runs once over full transcript (batch call, not per-chunk)
6. Report saved to PostgreSQL, `report_ready:{id}` published to Redis
7. Frontend polls `GET /reports/{id}` — 202 while generating, 200 when ready

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS 3 |
| Auth | NextAuth.js v4.24 (Google + GitHub OAuth, JWE sessions) |
| State | Zustand 5 with devtools |
| Charts | Recharts 2 |
| Landing 3D | Three.js (lazy-loaded) |
| Backend | FastAPI 0.115, Python 3.11, Uvicorn/Gunicorn |
| ORM | SQLAlchemy 2.0 async (asyncpg) + sync (psycopg2 for Celery) |
| Migrations | Alembic |
| Task Queue | Celery 5.4 (Redis broker + backend) |
| Database | PostgreSQL 16 |
| Cache / PubSub | Redis 7 |
| STT | faster-whisper (Whisper tiny.en, CPU int8) |
| LLM | Gemini 2.5 Flash via OpenAI-compatible endpoint |
| Structured LLM | instructor (JSON mode) |
| Agent Graph | LangGraph 0.2 |
| Logging | structlog |
| Infra (dev) | Docker Compose |
| Infra (prod) | Railway (backend), Vercel (frontend) |

---

## 4. User Flow

```
/ (landing) → /register or /login → /dashboard
  → /rooms (pick context + name session) → /session/{id} (live recording)
  → /report/{id} (coaching report, polls until ready)
  → /library (all past sessions)
  → /profile (stats)
  → /settings (dark mode, coming-soon stubs)
```

---

## 5. API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Basic health (Docker healthcheck) |
| GET | `/api/v1/health/full` | Extended health with service status |
| GET | `/api/v1/health/workers` | Celery queue diagnostics |
| POST | `/api/v1/sessions` | Create session |
| GET | `/api/v1/sessions` | List user's sessions (requires X-User-Email) |
| GET | `/api/v1/sessions/{id}` | Get session |
| PATCH | `/api/v1/sessions/{id}/end` | End session, dispatch coach |
| DELETE | `/api/v1/sessions/{id}` | Delete session + report |
| GET | `/api/v1/reports/{id}` | Get report (202 while generating) |
| WS | `/api/v1/ws/{id}` | Audio stream + state updates |

---

## 6. Database Schema

**`sessions`** — core session record  
`id (uuid PK), status, audience_profile, name, user_email (indexed), duration_seconds, overall_score, ended_at, report_ready, created_at, updated_at`

**`agent_events`** — append-only audit log of every agent output (transcript chunks, engagement signals, clarity analyses)  
`event_id, session_id (FK), chunk_id, agent_name, event_type, payload (JSONB), model_version, processing_time_ms, created_at`  
_Indexes: GIN on payload, composite on (agent_name, created_at), on session_id_

**`session_reports`** — final coaching report  
`id, session_id (FK unique), overall_score, engagement_avg, clarity_avg, insights (JSONB), rewrites (JSONB), summary, coach_model, wpm, created_at`

---

## 7. Authentication Flow

- NextAuth v4 creates **JWE sessions** (not plain JWT) — undecodable by PyJWT
- On every API call, frontend reads `session.user.email` from `getSession()` and sends it as `X-User-Email` header
- Backend reads `X-User-Email` directly — no token parsing required
- Soft ownership: `403` only when both `session.user_email` AND `current_user.email` are present and mismatched
- WebSocket connections pass without auth (browser WS API can't send custom headers); session UUID is the security boundary
- Middleware (`src/middleware.ts`) protects all authenticated routes via NextAuth

---

## 8. AI/ML Pipeline

```
Audio (webm/opus, 250ms slices)
  │
  ├── faster-whisper (Whisper tiny.en, CPU int8)
  │     word_timestamps + VAD filter
  │     → TranscriptChunk (text, words, language, logprob)
  │
  ├── EngagementClassifier (pure heuristic, no LLM)
  │     filler_ratio (0.4) + type_token_ratio (0.4) + avg_word_len (0.2)
  │     → score [0,1], label low/medium/high
  │
  └── [Session End] CoachAgent (LangGraph)
        fetch_events → all agent_events for session
        analyze_transcript_clarity → Gemini 2.5 Flash (1 call, full transcript)
        segment_analyzer → Gemini 2.5 Flash (classify weak/strong/critical)
        insight_synthesizer → Gemini 2.5 Flash (3-5 insights)
        rewrite_generator → Gemini 2.5 Flash (up to 3 rewrites of weak segments)
        save_report → PostgreSQL + Redis signal
```

All LangGraph nodes have heuristic fallbacks so the coach pipeline never leaves a session in "processing" permanently.

---

## 9. Security Review

| Area | Status | Notes |
|---|---|---|
| Auth (frontend) | ✅ Good | NextAuth JWE sessions, middleware-protected routes |
| Auth (backend) | ⚠️ Weak | X-User-Email header trusts frontend identity claim — no cryptographic verification. Acceptable for MVP behind CORS; add HMAC signing or JWT before public launch |
| User isolation | ✅ Good | Soft ownership check: 403 only on explicit mismatch; empty list instead of leaking other users' sessions |
| CORS | ✅ Good | Configurable via `CORS_ORIGINS` env var; defaults to localhost only |
| Secrets in config | ✅ Good | `SECRET_KEY` default is placeholder with production warning in entrypoint |
| WebSocket | ⚠️ Acceptable | No auth header possible via browser WS API; session UUID is the gate |
| SQL injection | ✅ Safe | SQLAlchemy ORM with parameterised queries throughout |
| XSS | ✅ Safe | React JSX escaping + Next.js App Router |
| CSRF | ✅ Safe | SameSite cookies (NextAuth default) + custom header (X-User-Email) |
| Docs in prod | ✅ Good | `/docs`, `/redoc`, `/openapi.json` disabled when `ENVIRONMENT=production` |
| Input validation | ✅ Good | Pydantic on all API request bodies |
| Non-root Docker | ✅ Good | Production containers run as `echoroom` / `nextjs` system users |

---

## 10. Performance Review

| Area | Status | Notes |
|---|---|---|
| STT | Acceptable | Whisper tiny.en on CPU; ~1-3s per 3s audio chunk. Upgrade to small.en for accuracy vs. latency tradeoff |
| Audio buffering | ✅ Good | EBML header stored once; header+clusters flushed together per ~3s or 48KB |
| DB connection pooling | ✅ Good | Async pool (size 10, overflow 20), sync pool for Celery, `pool_pre_ping`, `pool_recycle=3600` |
| Redis pub/sub | ✅ Good | Per-session channels; OrchestratorAgent creates a fresh Redis connection per WebSocket |
| N+1 queries | ✅ None | Sessions list and report both use single queries with no lazy loading |
| Engagement timeline | ✅ Good | Built server-side from `agent_events` in `_build_engagement_timeline`, single query |
| React rendering | ✅ Good | Recharts charts use `isAnimationActive={false}` in report to avoid re-render thrashing |
| Next.js bundle | Report page 9.54 kB / 222 kB first load (acceptable; Recharts is large) |
| Missing DB index | ⚠️ Consider adding composite `(session_id, agent_name)` index on `agent_events` if session count grows large |

---

## 11. Deployment Review

### Docker Compose (dev)
- ✅ All services have health checks
- ✅ Celery workers wait for `api:service_healthy` (migrations complete first)
- ✅ `RUN_MIGRATIONS=false` on workers — api owns the alembic_version lock
- ✅ Separate `worker` (local queue) and `worker_coach` (coach queue, concurrency=1 for LangGraph)
- ✅ Frontend standalone build used in production image

### Railway (backend)
- ✅ `DATABASE_URL` normalizer handles `postgres://` and `postgresql://` prefixes automatically
- ✅ HuggingFace model cache redirected to `/tmp/huggingface` (writable by non-root)
- ✅ Gunicorn + UvicornWorker in production entrypoint
- ✅ `ffmpeg` in Dockerfile base for webm audio decoding

### Vercel (frontend)
- ✅ `output: "standalone"` in next.config.mjs
- ✅ Remote image patterns for GitHub/Google avatars
- ✅ Next.js rewrites proxy `/api/v1/*` to backend via `INTERNAL_API_URL`

---

## 12. Cleanup Summary

### Files Deleted (8)

| File | Reason |
|---|---|
| `frontend/src/components/report/EngagementHeatmap.tsx` | Never imported — report page has inline chart |
| `frontend/src/components/report/InsightCard.tsx` | Never imported — report page defines its own `InsightCard` inline |
| `frontend/src/components/session/MetricsSidebar.tsx` | Never imported — session page has inline metrics |
| `frontend/src/components/session/SessionControls.tsx` | Never imported — references non-existent `bg-brand-500` |
| `frontend/src/components/session/TranscriptPane.tsx` | Never imported — references non-existent `text-brand-500` |
| `frontend/src/components/ui/Gauge.tsx` | Only imported by deleted MetricsSidebar |
| `frontend/src/lib/auth.ts` | Never imported — just re-exported next-auth symbols |
| `report.png` | Screenshot artifact, not referenced anywhere |

### Dependencies Removed (2 Python)

| Package | Reason |
|---|---|
| `soundfile==0.12.1` | No import found anywhere in the codebase |
| `numpy==1.26.4` | No import found anywhere in the codebase |

### Code Removed / Cleaned

| Location | Change |
|---|---|
| `backend/app/core/config.py` | Removed `OPENAI_API_KEY` (never referenced), `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (backend uses X-User-Email, not JWT validation) |
| `backend/app/schemas/events.py` | Removed `GeneratedQuestion`, `RetentionPrediction`, `SessionReportCreate` (never imported); removed `latest_question`, `retention_score` fields from `SessionStateUpdate` (never populated by orchestrator) |
| `backend/app/workers/tasks.py` | Removed `analyze_clarity` task (explicitly noted in code as never dispatched — clarity now done once by coach) |
| `backend/app/workers/celery_app.py` | Removed `analyze_clarity` route entry from `task_routes` |
| `backend/app/agents/clarity_agent.py` | Removed `analyze_clarity` per-chunk function (only called by removed task); kept `analyze_transcript_clarity` (used by CoachAgent) |
| `frontend/src/store/index.ts` | Removed `HealthSlice` (`checkHealth` never called from any page); removed `createSession` (rooms page uses `lib/api.ts` directly) |
| `frontend/src/types/index.ts` | Removed `ServiceStatus`, `FullHealthResponse` (only used by removed health slice); removed `latest_question`, `retention_score` from `SessionStateUpdate` (never sent by backend) |
| `.env.example` | Fixed git merge conflict (`<<<<<<< HEAD` / `=======` / `>>>>>>>`) |
| `.gitignore` | Added `*.tsbuildinfo` (generated TypeScript build artifact) |

---

## 13. Resume Evaluation

### Google Internship
**Score: 7.5/10**

Strengths: Genuinely complex distributed architecture (WebSocket, Celery, Redis pub/sub, LangGraph). Uses production-grade patterns (async SQLAlchemy, alembic, structured logging, non-root Docker). The LangGraph multi-node coach pipeline with graceful fallbacks shows depth.

Gaps: Test suite is skeleton only (unit tests exist but are minimal; no integration tests beyond a stub). No rate limiting or request validation hardening. The X-User-Email auth approach would raise concerns about security design in a Google interview.

### Microsoft Internship
**Score: 7.5/10**

Similar assessment. Strong on architecture and end-to-end product thinking. Celery task decomposition and the append-only event log design (`agent_events`) show good system design instincts. Gaps: no CI/CD pipeline, no automated tests running.

### Startup Engineer Role
**Score: 8.5/10**

Excellent for a startup context. Full-stack, working product, AI integration, real-time features, deployable. The pragmatic auth (X-User-Email over complex JWT dance) is startup-appropriate. Landing page quality is high. The project covers: OAuth, WebSockets, async Python, LLM integration, queuing, DB migrations — impressive breadth.

### New Graduate SWE Role
**Portfolio Score: 9/10**

This is exceptional portfolio work for a new grad. Very few new grads ship a real-time multi-agent system with a polished, dark-mode-correct UI. The architecture choices (why Celery, why LangGraph, why faster-whisper locally vs API) show genuine engineering judgment.

---

## 14. Production Readiness Evaluation

**Score: 6/10**

| Dimension | Score | Notes |
|---|---|---|
| Architecture Quality | 8/10 | Solid separation of concerns; correct async patterns |
| Security | 5/10 | X-User-Email header is not cryptographically verified — spoofable without CORS; acceptable for early MVP |
| Test Coverage | 2/10 | Skeleton tests only; no integration tests, no CI |
| Observability | 6/10 | structlog throughout; no metrics (Prometheus/Datadog) or distributed tracing |
| Error Handling | 7/10 | Coach pipeline has exhaustive fallbacks; API returns correct status codes |
| Scalability | 5/10 | Single Whisper model in memory per worker (not horizontally scalable yet) |
| Documentation | 7/10 | ARCHITECTURE.md, PRODUCT.md, DESIGN.md all present and accurate |

---

## 15. Recommended Next Steps

**Security (before public launch):**
1. Replace X-User-Email with HMAC-signed header or short-lived backend-issued token
2. Add rate limiting on session creation (prevent abuse)
3. Add input length validation on session name

**Reliability:**
4. Write integration tests: session lifecycle, report generation, WebSocket frame handling
5. Add CI pipeline (GitHub Actions): lint + typecheck + test on PR
6. Add a dead-letter queue for failed Celery tasks

**Performance:**
7. Upgrade Whisper to `small.en` — 5–8% WER improvement, manageable latency
8. Add composite DB index `(session_id, agent_name)` on `agent_events`
9. Add Redis TTL to pub/sub keys so orphaned channels expire

**Product:**
10. Implement notifications (page exists, stub)
11. Implement profile edit
12. Add session sharing / export-to-PDF for coaching reports
13. Add streak tracking using real session timestamps
