from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def get_rate_limit_key(request):
    """
    Rate limit by the last 32 chars of the JWT token when authenticated,
    otherwise by IP. This avoids decoding the token on every request
    while still isolating limits per user session rather than per IP
    (important for shared networks like offices or carrier-grade NAT).
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[-32:]
    return get_remote_address(request)


# Redis-backed storage so counters are shared across gunicorn workers.
# In-memory storage (the default) gives each worker process its own counter,
# which means --workers 2 effectively doubles the allowed request rate since
# requests are load-balanced across processes.
limiter = Limiter(
    key_func=get_rate_limit_key,
    storage_uri=settings.REDIS_URL,
)
