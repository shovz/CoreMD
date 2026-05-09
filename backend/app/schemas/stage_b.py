from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.question import Difficulty


class StageBStartRequest(BaseModel):
    topics: List[str] = Field(default_factory=list)
    case_count: int = Field(default=2, ge=1, le=3)
    duration_minutes: int = Field(default=45, ge=30, le=90)
    difficulty: Difficulty = Difficulty.medium
    voice: str = Field(default="alloy")


# Question as returned in session GET — model_answer/key_points excluded
class StageBQuestion(BaseModel):
    question_id: str
    stage_index: int
    stem: str
    topic: str
    difficulty: Difficulty
    # grading result fields — null until answered
    student_answer: Optional[str] = None
    answer_mode: Optional[str] = None  # "text" | "audio"
    score: Optional[float] = None  # 0.0–1.0
    feedback: Optional[str] = None
    key_points_hit: Optional[List[str]] = None
    answered_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Full question including server-side fields — used in report
class StageBQuestionFull(StageBQuestion):
    model_answer: Optional[str] = None
    key_points: Optional[List[str]] = None


class StageBStage(BaseModel):
    stage_index: int
    title: str
    context: str
    questions: List[StageBQuestion]

    class Config:
        orm_mode = True


class StageBCase(BaseModel):
    case_index: int
    case_id: str
    title: str
    chief_complaint: str
    stages: List[StageBStage]

    class Config:
        orm_mode = True


class StageBSessionOut(BaseModel):
    session_id: str
    exam_type: str = "stage-b"
    status: str
    difficulty: Difficulty
    voice: str
    case_count: int
    duration_minutes: int
    started_at: datetime
    expires_at: datetime
    finalized_at: Optional[datetime] = None
    current_case_idx: int
    current_stage_idx: int
    cases: List[StageBCase]

    class Config:
        orm_mode = True


class StageBAnswerCreate(BaseModel):
    student_answer: str = Field(..., max_length=5000)
    answer_mode: str = Field(..., pattern="^(text|audio)$")


class StageBAnswerResult(BaseModel):
    score: float
    feedback: str
    key_points_hit: List[str]
    model_answer: str  # revealed after grading
    remaining_seconds: int
    all_stage_questions_answered: bool


# Report structures — include model answers
class StageBStageReport(BaseModel):
    stage_index: int
    title: str
    context: str
    questions: List[StageBQuestionFull]


class StageBCaseReport(BaseModel):
    case_index: int
    case_id: str
    title: str
    chief_complaint: str
    stages: List[StageBStageReport]
    answered_count: int
    total_questions: int
    avg_score: Optional[float] = None


class StageBReportOut(BaseModel):
    session_id: str
    status: str
    difficulty: Difficulty
    voice: str
    case_count: int
    duration_minutes: int
    started_at: datetime
    finalized_at: Optional[datetime] = None
    elapsed_seconds: int
    total_questions: int
    answered_count: int
    avg_score: Optional[float] = None
    by_topic: List[dict]
    by_difficulty: List[dict]
    cases: List[StageBCaseReport]


# ---- Chat with examiner ------------------------------------------------------

class StageBChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class StageBChatRequest(BaseModel):
    message: str = Field(..., max_length=2000)
    history: List[StageBChatMessage] = Field(default_factory=list)


class StageBChatReply(BaseModel):
    reply: str


# ---- Session history / retake ------------------------------------------------

class StageBSessionSummary(BaseModel):
    session_id: str
    status: str
    difficulty: Difficulty
    case_count: int
    duration_minutes: int
    voice: str
    started_at: datetime
    finalized_at: Optional[datetime] = None

    class Config:
        orm_mode = True
