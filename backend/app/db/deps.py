from app.db.mongo import get_db
from app.db.redis import get_redis


def mongo_db():
    """
    Dependency that provides MongoDB database.
    """
    return get_db()


def redis_client():
    """
    Dependency that provides Redis client.
    """
    return get_redis()
