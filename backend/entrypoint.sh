#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# EchoRoom API Entrypoint
# Waits for dependencies, runs migrations, then starts the server.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EchoRoom API — Starting up"
echo "  Environment: ${ENVIRONMENT:-development}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Wait for PostgreSQL ───────────────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL..."
until python -c "
import asyncio, asyncpg, os, sys
async def check():
    url = os.environ['DATABASE_URL'].replace('+asyncpg', '')
    try:
        conn = await asyncpg.connect(url)
        await conn.close()
    except Exception as e:
        sys.exit(1)
asyncio.run(check())
" 2>/dev/null; do
    echo "   PostgreSQL not ready — retrying in 2s..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# ── Wait for Redis ────────────────────────────────────────────────────────────
echo "⏳ Waiting for Redis..."
until python -c "
import asyncio, redis.asyncio as r, os, sys
async def check():
    client = r.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379'))
    try:
        await client.ping()
        await client.aclose()
    except Exception:
        sys.exit(1)
asyncio.run(check())
" 2>/dev/null; do
    echo "   Redis not ready — retrying in 2s..."
    sleep 2
done
echo "✅ Redis is ready"

# ── Run Alembic Migrations ────────────────────────────────────────────────────
echo "🗄️  Running database migrations..."
alembic upgrade head
echo "✅ Migrations complete"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Starting server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exec "$@"
