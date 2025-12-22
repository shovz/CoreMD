from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

_client: MongoClient | None = None
_db: Database | None = None


def connect_to_mongo() -> None:
    """
    Create ONE MongoClient for the whole app process.
    This is called on FastAPI startup.
    """
    global _client, _db
    _client = MongoClient(settings.MONGO_URI)
    _db = _client.get_default_database()  # uses db name from URI, e.g. /coremd


def close_mongo_connection() -> None:
    """
    Close the MongoClient when the app shuts down.
    """
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> Database:
    """
    Access the connected Database object anywhere in the app.
    """
    if _db is None:
        raise RuntimeError("MongoDB is not initialized. Did startup run?")
    return _db
