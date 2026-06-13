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
DB_HOST=$(python3 -c "
import os
from urllib.parse import urlparse
url = os.environ.get('DATABASE_URL', '')
url = url.replace('+asyncpg','').replace('+psycopg2','')
p = urlparse(url)
print(p.hostname or 'localhost')
")
DB_PORT=$(python3 -c "
import os
from urllib.parse import urlparse
url = os.environ.get('DATABASE_URL', '')
url = url.replace('+asyncpg','').replace('+psycopg2','')
p = urlparse(url)
print(p.port or 5432)
")
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -t 1 > /dev/null 2>&1; do
    echo "   PostgreSQL not ready — retrying in 2s..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# ── Wait for Redis ────────────────────────────────────────────────────────────
echo "⏳ Waiting for Redis..."
REDIS_HOST=$(python3 -c "
import os
from urllib.parse import urlparse
url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
p = urlparse(url)
print(p.hostname or 'localhost')
")
REDIS_PORT=$(python3 -c "
import os
from urllib.parse import urlparse
url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
p = urlparse(url)
print(p.port or 6379)
")
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; do
    echo "   Redis not ready — retrying in 2s..."
    sleep 2
done
echo "✅ Redis is ready"

# ── Run Alembic Migrations ────────────────────────────────────────────────────
# Migrations run from ONE place only (the api service) to avoid a startup race
# where multiple services upgrade concurrently and collide on alembic_version.
# Workers set RUN_MIGRATIONS=false and wait for api (which owns migrations).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "🗄️  Running database migrations..."
    alembic upgrade head
    echo "✅ Migrations complete"
else
    echo "⏭️  Skipping migrations (RUN_MIGRATIONS=false — api owns migrations)"
fi

# ── Production readiness guard ────────────────────────────────────────────────
if [ "${ENVIRONMENT:-development}" = "production" ]; then
    _SECRET="${SECRET_KEY:-}"
    if [ -z "$_SECRET" ] || [ "$_SECRET" = "change-me-in-production-use-openssl-rand-hex-32" ]; then
        echo "⚠️  WARNING: SECRET_KEY is not set or is the default placeholder."
        echo "   Set SECRET_KEY to the output of: openssl rand -hex 32"
    fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Starting server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exec "$@"
