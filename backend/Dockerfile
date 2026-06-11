# ─────────────────────────────────────────────────────────────────────────────
# EchoRoom Backend Dockerfile
# Multi-stage: development (hot-reload) + production (gunicorn)
# ─────────────────────────────────────────────────────────────────────────────

# ── Base ──────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    ffmpeg \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Development ───────────────────────────────────────────────────────────────
FROM base AS development

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# App code is mounted as a volume — no COPY needed for dev
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--log-level", "info"]

# ── Production ────────────────────────────────────────────────────────────────
FROM base AS production

# Non-root user
RUN groupadd --system echoroom && useradd --system --gid echoroom echoroom

COPY requirements.txt ./
RUN pip install -r requirements.txt gunicorn==23.0.0

COPY --chown=echoroom:echoroom . .
COPY --chown=echoroom:echoroom entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER echoroom

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--log-level", "info"]
