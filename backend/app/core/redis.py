from __future__ import annotations

from redis.asyncio import Redis, ConnectionPool
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

_pool: ConnectionPool | None = None
_client: Redis | None = None


async def init_redis() -> None:
    """Initialize the Redis connection pool. Call once at app startup."""
    global _pool, _client
    _pool = ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_MAX_CONNECTIONS,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )
    _client = Redis(connection_pool=_pool)
    # Verify connection
    await _client.ping()
    log.info("Redis connection pool initialized", url=settings.REDIS_URL)


async def close_redis() -> None:
    """Close the Redis connection pool. Call once at app shutdown."""
    global _pool, _client
    if _client is not None:
        await _client.aclose()
        _client = None
    if _pool is not None:
        await _pool.aclose()
        _pool = None
    log.info("Redis connections closed")


def get_redis_client() -> Redis:
    """
    Return the active Redis client.
    Raises RuntimeError if init_redis() has not been called.
    """
    if _client is None:
        raise RuntimeError("Redis not initialized — call init_redis() first.")
    return _client


async def check_redis_health() -> bool:
    """Returns True if Redis is reachable."""
    try:
        client = get_redis_client()
        await client.ping()
        return True
    except Exception as exc:
        log.error("Redis health check failed", error=str(exc))
        return False
