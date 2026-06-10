# EchoRoom

**Agentic Communication Intelligence Platform**

Real-time multi-agent AI system that analyzes speech as you speak, simulates audience
reactions, detects unclear explanations, and generates a coaching report at the end of
every session.

---

## System Status

| Service | Status |
|---------|--------|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Quickstart

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Run with Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/yourusername/echoroom.git
cd echoroom

# 2. Environment
cp .env.example .env          # Edit values if needed

# 3. Start everything
docker compose up

# 4. Verify
curl http://localhost:8000/api/v1/health/full
```

### Local Backend Development

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start dependencies only
docker compose up postgres redis -d

# Run migrations
alembic upgrade head

# Start API with hot-reload
uvicorn app.main:app --reload --port 8000
```

### Local Frontend Development

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind, Zustand |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Logging | structlog |
| AI (Week 2+) | OpenAI GPT-4o, Whisper, distilbert |
| Agents (Week 2+) | LangGraph, Celery |

---

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md)

---

## Project Structure

```
EchoRoom/
├── backend/          FastAPI application
│   ├── app/
│   │   ├── api/      Route handlers
│   │   ├── core/     Config, DB, Redis, logging
│   │   ├── models/   SQLAlchemy ORM models
│   │   └── schemas/  Pydantic schemas
│   └── alembic/      Database migrations
├── frontend/         Next.js application
│   └── src/
│       ├── app/      Pages (App Router)
│       ├── store/    Zustand state
│       └── types/    TypeScript interfaces
├── docs/             Architecture docs
├── ai/               CLAUDE.md (AI dev memory)
└── docker/           Container init scripts
```

---

## Contributing

This is a student portfolio project. See `ai/CLAUDE.md` for architectural decisions
and development conventions.

---

## License

MIT
