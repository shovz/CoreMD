from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from app.core.config import settings
from app.db.mongo import get_db


# Import the auth router
from app.api.v1.routes import auth, chapters, questions, cases, ai, debug, stats

# Database connections
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.db.redis import connect_to_redis, close_redis_connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect_to_mongo()
    print("MongoDB connected")

    db = get_db()
    db.users.create_index("email", unique=True)

    connect_to_redis()
    print("Redis connected")

    yield

    close_mongo_connection()
    close_redis_connection()


app = FastAPI(title="CoreMD Backend", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:80",
        "http://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(chapters.router, prefix="/api/v1")
app.include_router(questions.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(debug.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "Welcome to the CoreMD Backend!"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "mongo_uri": settings.MONGO_URI,
        "redis_url": settings.REDIS_URL,
    }


# Shoval, how to run the server:
# python -m uvicorn app.main:app --reload
