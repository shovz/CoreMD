from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.core.config import settings

# Import the auth router
from app.api.v1.routes import auth, chapters, questions, cases, ai, debug

# Database connections
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.db.redis import connect_to_redis, close_redis_connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 🔵 STARTUP
    connect_to_mongo()
    print("MongoDB connected")
    connect_to_redis()
    print("Redis connected")

    yield  # ⬅️ FastAPI runs here

    # 🔴 SHUTDOWN
    close_mongo_connection()
    print("MongoDB connection closed")
    close_redis_connection()
    print("Redis connection closed")

app = FastAPI(
    title="CoreMD Backend",
    lifespan=lifespan
)

# Register routers
app.include_router(auth.router)
app.include_router(chapters.router)
app.include_router(questions.router)
app.include_router(cases.router)
app.include_router(ai.router)
app.include_router(debug.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the CoreMD Backend!"}

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "mongo_uri": settings.MONGO_URI, 
        "redis_url": settings.REDIS_URL
    }

# python -m uvicorn app.main:app --reload
