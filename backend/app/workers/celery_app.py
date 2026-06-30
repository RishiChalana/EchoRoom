from __future__ import annotations

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration

from celery import Celery
from app.core.config import settings

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[CeleryIntegration()],
        send_default_pii=False,
        traces_sample_rate=0.1,
    )

celery_app = Celery(
    "echoroom",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.tasks.transcribe_chunk": {"queue": "local"},
        "app.workers.tasks.classify_engagement": {"queue": "local"},
        "app.workers.tasks.process_coach_session": {"queue": "coach"},
    },
    task_default_queue="local",
)
