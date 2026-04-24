from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class OverviewStatsOut(BaseModel):
    total_questions_answered: int = 0
    correct_percentage: float = 0.0
    unique_chapters_covered: int = 0


class DifficultyStats(BaseModel):
    attempted: int = 0
    accuracy: float = 0.0


class TopicStats(BaseModel):
    topic: str
    attempted: int = 0
    accuracy: float = 0.0


class QuestionStatsOut(BaseModel):
    # Example:
    # {
    #   "easy": {"attempted": 10, "accuracy": 80.0},
    #   "medium": {"attempted": 20, "accuracy": 55.0}
    # }
    by_difficulty: Dict[str, DifficultyStats] = Field(default_factory=dict)

    # Example:
    # [{"topic": "Cardiology", "attempted": 12, "accuracy": 66.7}, ...]
    by_topic: List[TopicStats] = Field(default_factory=list)


class ChapterStatsItem(BaseModel):
    chapter_id: str
    attempted: int = 0
    accuracy: float = 0.0


class ChapterStatsOut(BaseModel):
    chapters: List[ChapterStatsItem] = Field(default_factory=list)
