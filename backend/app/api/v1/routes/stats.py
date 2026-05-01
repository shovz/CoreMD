from fastapi import APIRouter, Depends
from pymongo.database import Database
from redis import Redis
import json


from app.db.deps import mongo_db, redis_client

from app.core.auth import get_current_user_id
from app.services import stats_service
from app.schemas.stats import (
    OverviewStatsOut,
    QuestionStatsOut,
    ChapterStatsOut,
    DashboardStatsOut,
)


router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview", response_model=OverviewStatsOut)
def overview_stats(
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
    user_id: str = Depends(get_current_user_id),
):
    cache_key = f"stats:overview:{user_id}"

    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    data = stats_service.get_overview_stats(db, user_id)

    redis.setex(cache_key, 120, json.dumps(data))
    return data

@router.get("/questions", response_model=QuestionStatsOut)
def question_stats(
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
    user_id: str = Depends(get_current_user_id),
):
    cache_key = f"stats:questions:{user_id}"

    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    data = stats_service.get_question_stats(db, user_id)
    redis.setex(cache_key, 120, json.dumps(data))
    return data

@router.get("/dashboard", response_model=DashboardStatsOut)
def dashboard_stats(
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
    user_id: str = Depends(get_current_user_id),
):
    cache_key = f"stats:dashboard:{user_id}"

    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    data = stats_service.get_dashboard_stats(db, user_id)
    redis.setex(cache_key, 120, json.dumps(data))
    return data


@router.get("/chapters", response_model=ChapterStatsOut)
def chapter_stats(
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
    user_id: str = Depends(get_current_user_id),
):
    cache_key = f"stats:chapters:{user_id}"

    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    chapters = stats_service.get_chapter_stats(db, user_id)
    data = {"chapters": chapters}

    redis.setex(cache_key, 120, json.dumps(data))
    return data
