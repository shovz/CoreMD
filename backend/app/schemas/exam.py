from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.question import Difficulty


class StageAExamItem(BaseModel):
    index: int
    question_id: str
    stem: str
    options: List[str]
    topic: str
    chapter_id: Optional[str] = None
    difficulty: Difficulty
    selected_option: Optional[int] = None
    is_correct: Optional[bool] = None
    answered_at: Optional[datetime] = None


class StageAExamSessionOut(BaseModel):
    session_id: str
    exam_type: str = "stage-a"
    status: str
    blueprint_version: str
    requested_question_count: int
    actual_question_count: int
    shortened_due_to_pool: bool
    scope: dict
    question_count: int
    duration_seconds: int
    started_at: datetime
    expires_at: datetime
    finalized_at: Optional[datetime] = None
    items: List[StageAExamItem]


class StageAAnswerCreate(BaseModel):
    index: int = Field(..., ge=1)
    selected_option: int = Field(..., ge=0, le=3)
    rationale_text: Optional[str] = None


class StageAAnswerResult(BaseModel):
    correct: bool
    correct_option: int
    explanation: str
    answered_count: int
    correct_count: int
    remaining_seconds: int


class StageAReportOut(BaseModel):
    session_id: str
    status: str
    question_count: int
    requested_question_count: int
    actual_question_count: int
    shortened_due_to_pool: bool
    scope: dict
    answered_count: int
    correct_count: int
    percent_correct: float
    started_at: datetime
    finalized_at: datetime
    duration_seconds: int
    elapsed_seconds: int
    by_topic: List[dict]
    by_difficulty: List[dict]
    review_items: List[dict] = Field(default_factory=list)


class StageAStartRequest(BaseModel):
    topics: List[str] = Field(default_factory=list)
    topic_weights: dict[str, int] = Field(default_factory=dict)
    part_numbers: List[int] = Field(default_factory=list)
    chapter_ids: List[str] = Field(default_factory=list)
    exclude_answered_correctly: bool = False


class StageAPreviewOut(BaseModel):
    eligible_count: int
    requested_question_count: int
    actual_question_count: int
    shortened_due_to_pool: bool


class StageAExamPresetIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    topics: List[str] = Field(default_factory=list)
    topic_weights: dict[str, int] = Field(default_factory=dict)
    part_numbers: List[int] = Field(default_factory=list)
    chapter_ids: List[str] = Field(default_factory=list)
    exclude_answered_correctly: bool = False


class StageAExamPresetOut(StageAExamPresetIn):
    preset_id: str
    created_at: datetime
    updated_at: datetime
