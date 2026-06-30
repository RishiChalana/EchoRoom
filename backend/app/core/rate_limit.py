from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def get_rate_limit_key(request):
    """
    Rate limit key for unauthenticated requests.

    On Railway (and any cloud platform with a reverse proxy), request.client.host
    returns the internal proxy IP, not the real client IP. Railway's proxy pool can
    assign different internal IPs across sequential requests from the same client,
    so each request would get a unique key and the counter would never accumulate.

    Fix: prefer X-Forwarded-For, which Railway's edge proxy always sets to the real
    client IP before forwarding. Take the leftmost entry (original client) from the
    potentially comma-separated chain of proxies. Fall back to client.host for
    local/non-proxied environments where X-Forwarded-For is absent.

    For authenticated requests, use the last 32 chars of the JWT token instead of
    IP — more accurate than IP since multiple users may share a corporate NAT IP
    and one user's traffic shouldn't count against another.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[-32:]

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    return get_remote_address(request)


# Redis-backed storage so counters are shared across gunicorn workers.
# In-memory storage (the default) gives each worker process its own counter,
# which means --workers 2 effectively doubles the allowed request rate since
# requests are load-balanced across processes.
limiter = Limiter(
    key_func=get_rate_limit_key,
    storage_uri=settings.REDIS_URL,
)
