import redis
from redis import Redis

from app.core.config import settings

_redis: Redis | None = None


def connect_to_redis() -> None:
    """
    Create a single Redis client for the app.
    """
    global _redis
    _redis = redis.Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True  # return strings instead of bytes
    )


def close_redis_connection() -> None:
    """
    Close Redis connection on shutdown.
    """
    global _redis
    if _redis is not None:
        _redis.close()
    _redis = None


def get_redis() -> Redis:
    """
    Access Redis client anywhere in the app.
    """
    if _redis is None:
        raise RuntimeError("Redis is not initialized.")
    return _redis
