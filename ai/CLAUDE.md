# CLAUDE.md — EchoRoom Project Memory
# ─────────────────────────────────────────────────────────────────────────────
# READ THIS FIRST in every Claude Code session.
# Update this file after every architectural decision.
# ─────────────────────────────────────────────────────────────────────────────

## Project Overview
EchoRoom is a real-time multi-agent AI system for communication intelligence.
10 specialized agents process speech in real-time and generate coaching feedback.

**Target users:** Educators, sales professionals, public speakers.
**Core value:** Close the feedback loop during practice — before a live audience.

## Current Status
- Phase: Foundation (Week 1)
- Last completed: Project scaffold, Docker setup, health endpoints
- In progress: —
- Blocked on: —

## Architecture Decisions (LOCKED — Do NOT change without updating this file)

### Backend
- **Agent communication:** Redis pub/sub ONLY (NOT direct function calls between agents)
- **LLM calls:** Celery tasks ONLY (NEVER call OpenAI directly in async FastAPI endpoints)
- **Structured outputs:** `instructor` library wrapping OpenAI (NEVER parse raw JSON manually)
- **Audit log:** `agent_events` table is APPEND-ONLY (NEVER UPDATE or DELETE rows)
- **EngagementClassifier:** Local distilbert model (NEVER route to LLM — latency would break real-time)
- **WebSocket:** One endpoint per session `/ws/{session_id}` — single connection per user
- **DB sessions:** Use `get_db()` dependency injection only (NEVER create sessions manually in routes)

### Frontend
- **State management:** Zustand only (NO Context API, NO Redux)
- **API calls from components:** Via `apiFetch` in `src/lib/utils.ts` only
- **TypeScript:** Strict mode always. No `any` types.

### Infrastructure
- **Auth:** POSTPONED until Week 10 — use X-API-KEY header with dev key until then
- **LangGraph:** Used in CoachAgent ONLY (NOT in real-time pipeline agents)
- **Nginx:** Optional in dev — required in production

## Directory Structure
```
EchoRoom/
├── backend/
│   ├── app/
│   │   ├── api/v1/         ← FastAPI route handlers
│   │   ├── core/           ← config, database, redis, logging
│   │   ├── models/         ← SQLAlchemy ORM models
│   │   ├── schemas/        ← Pydantic request/response schemas
│   │   └── main.py         ← FastAPI app factory
│   ├── alembic/            ← DB migrations
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/            ← Next.js App Router pages
│       ├── components/     ← React components
│       ├── lib/            ← Utilities (apiFetch, cn)
│       ├── store/          ← Zustand store
│       └── types/          ← TypeScript interfaces (mirror Pydantic schemas)
├── docs/                   ← Architecture docs, decisions
├── ai/                     ← This file + future AI config
└── docker/postgres/        ← DB init scripts
```

## Redis Channel Naming (to be populated Week 2+)
```
transcript:{session_id}     ← TranscriptAgent publishes
engagement:{session_id}     ← EngagementClassifierAgent publishes
clarity:{session_id}        ← ClarityAnalyzerAgent publishes
questions:{session_id}      ← QuestionSynthesizerAgent publishes
retention:{session_id}      ← RetentionPredictorAgent publishes
report_ready:{session_id}   ← CoachAgent publishes
```

## Running Locally
```bash
docker compose up                          # Start all services
docker compose up api                      # Backend only
docker compose logs -f api                 # Watch API logs
alembic upgrade head                       # Run migrations
alembic revision --autogenerate -m "name" # Create a migration
```

## Test Commands
```bash
cd backend
pytest tests/unit/                         # Unit tests (fast, no Docker)
pytest tests/integration/ -m integration   # Requires Docker services
pytest tests/ -m eval                      # Eval tests (requires benchmark dataset)
```

## Health Check URLs (local)
- API basic:    http://localhost:8000/api/v1/health
- API full:     http://localhost:8000/api/v1/health/full
- API docs:     http://localhost:8000/docs
- Frontend:     http://localhost:3000
- Postgres:     localhost:5432 (echoroom / echoroom_dev_pass)
- Redis:        localhost:6379

## Prompt Locations
All LLM system prompts → `backend/prompts/*.txt` (created Week 2+)
Never hardcode prompts in agent Python files.

## Environment Variables Required
| Variable          | Required by | Notes |
|-------------------|------------|-------|
| DATABASE_URL      | Backend    | postgresql+asyncpg://... |
| REDIS_URL         | Backend    | redis://... |
| SECRET_KEY        | Backend    | 32-byte hex |
| OPENAI_API_KEY    | Week 2+    | Leave blank for now |

## Known Issues / TODOs
- [ ] Add rate limiting middleware (Week 6)
- [ ] Add request ID middleware + tracing (Week 8)
- [ ] Add auth (Week 10)

## Evaluation Baselines (populated as agents are built)
| Agent | Metric | Baseline | Current Best |
|-------|--------|----------|-------------|
| EngagementClassifier | AUC-ROC | — | — |
| ClarityAnalyzer | F1 | — | — |
| QuestionSynthesizer | G-Eval | — | — |
