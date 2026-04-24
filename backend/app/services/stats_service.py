from datetime import datetime, timezone, timedelta, date as date_type

from bson import ObjectId
from pymongo.database import Database
from typing import Dict, List


def _compute_streak(db: Database, user_id: str) -> int:
    oid = ObjectId(user_id)
    pipeline = [
        {"$match": {"user_id": oid}},
        {"$group": {
            "_id": {
                "year": {"$year": "$created_at"},
                "month": {"$month": "$created_at"},
                "day": {"$dayOfMonth": "$created_at"},
            }
        }},
    ]
    docs = list(db.question_attempts.aggregate(pipeline))
    if not docs:
        return 0

    activity_dates = sorted(
        {date_type(d["_id"]["year"], d["_id"]["month"], d["_id"]["day"]) for d in docs},
        reverse=True,
    )

    today = datetime.now(timezone.utc).date()
    # Streak is broken if most recent activity was before yesterday
    if activity_dates[0] < today - timedelta(days=1):
        return 0

    streak = 0
    expected = activity_dates[0]
    for d in activity_dates:
        if d == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        else:
            break

    return streak


def get_overview_stats(db: Database, user_id: str) -> Dict:
    """
    Returns high-level statistics for a user:
    - total questions answered
    - accuracy percentage
    - unique chapters covered
    """

    pipeline = [
        {
            "$match": {
                "user_id": ObjectId(user_id)
            }
        },
        {
            "$lookup": {
                "from": "questions",
                "localField": "question_id",
                "foreignField": "question_id",
                "as": "question"
            }
        },
        {
            "$unwind": "$question"
        },
        {
            "$group": {
                "_id": None,
                "total_attempts": {"$sum": 1},
                "correct_count": {
                    "$sum": {
                        "$cond": ["$is_correct", 1, 0]
                    }
                },
                "chapters": {
                    "$addToSet": "$question.chapter_id"
                }
            }
        },
        {
            "$project": {
                "_id": 0,
                "total_questions_answered": "$total_attempts",
                "correct_percentage": {
                    "$cond": [
                        {"$eq": ["$total_attempts", 0]},
                        0,
                        {
                            "$multiply": [
                                {"$divide": ["$correct_count", "$total_attempts"]},
                                100
                            ]
                        }
                    ]
                },
                "unique_chapters_covered": {
                    "$size": "$chapters"
                }
            }
        }
    ]

    result = list(db.question_attempts.aggregate(pipeline))
    return result[0] if result else {
        "total_questions_answered": 0,
        "correct_percentage": 0,
        "unique_chapters_covered": 0
    }


def get_question_stats(db: Database, user_id: str) -> Dict:
    """
    Returns question performance stats grouped by:
    - difficulty
    - topic
    """

    pipeline = [
        {
            "$match": {
                "user_id": ObjectId(user_id)
            }
        },
        {
            "$lookup": {
                "from": "questions",
                "localField": "question_id",
                "foreignField": "question_id",
                "as": "question"
            }
        },
        {"$unwind": "$question"},
        {
            "$facet": {
                "by_difficulty": [
                    {
                        "$group": {
                            "_id": "$question.difficulty",
                            "attempted": {"$sum": 1},
                            "correct": {
                                "$sum": {
                                    "$cond": ["$is_correct", 1, 0]
                                }
                            }
                        }
                    },
                    {
                        "$project": {
                            "_id": 0,
                            "difficulty": "$_id",
                            "attempted": 1,
                            "accuracy": {
                                "$multiply": [
                                    {"$divide": ["$correct", "$attempted"]},
                                    100
                                ]
                            }
                        }
                    }
                ],
                "by_topic": [
                    {
                        "$group": {
                            "_id": "$question.topic",
                            "attempted": {"$sum": 1},
                            "correct": {
                                "$sum": {
                                    "$cond": ["$is_correct", 1, 0]
                                }
                            }
                        }
                    },
                    {
                        "$project": {
                            "_id": 0,
                            "topic": "$_id",
                            "attempted": 1,
                            "accuracy": {
                                "$multiply": [
                                    {"$divide": ["$correct", "$attempted"]},
                                    100
                                ]
                            }
                        }
                    }
                ]
            }
        }
    ]

    result = list(db.question_attempts.aggregate(pipeline))
    raw = result[0] if result else {"by_difficulty": [], "by_topic": []}

    # $facet returns by_difficulty as a list; schema expects Dict[str, DifficultyStats]
    by_difficulty_dict = {
        item["difficulty"]: {"attempted": item["attempted"], "accuracy": item["accuracy"]}
        for item in raw.get("by_difficulty", [])
        if item.get("difficulty")
    }

    return {
        "by_difficulty": by_difficulty_dict,
        "by_topic": raw.get("by_topic", []),
    }


def get_dashboard_stats(db: Database, user_id: str) -> Dict:
    """Returns all data needed for the Study Deck dashboard widget."""
    oid = ObjectId(user_id)

    agg = list(db.question_attempts.aggregate([
        {"$match": {"user_id": oid}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "correct": {"$sum": {"$cond": ["$is_correct", 1, 0]}},
        }},
    ]))

    if agg:
        total = agg[0]["total"]
        correct = agg[0]["correct"]
        accuracy_pct = round(correct / total * 100, 1) if total > 0 else 0.0
    else:
        total = 0
        accuracy_pct = 0.0

    last_attempt = list(db.question_attempts.aggregate([
        {"$match": {"user_id": oid}},
        {"$sort": {"created_at": -1}},
        {"$limit": 1},
        {"$lookup": {
            "from": "questions",
            "localField": "question_id",
            "foreignField": "question_id",
            "as": "question",
        }},
        {"$unwind": {"path": "$question", "preserveNullAndEmptyArrays": True}},
    ]))

    last_question = None
    last_chapter = None
    if last_attempt:
        attempt = last_attempt[0]
        q = attempt.get("question")
        if q:
            last_question = {"id": attempt["question_id"], "topic": q.get("topic", "")}
            chapter_ref = q.get("chapter_ref")
            if chapter_ref:
                ch_doc = db.chapters.find_one(
                    {"chapter_id": chapter_ref}, {"_id": 0, "title": 1}
                )
                if ch_doc:
                    last_chapter = {"id": chapter_ref, "title": ch_doc["title"]}

    weak_topics_agg = list(db.question_attempts.aggregate([
        {"$match": {"user_id": oid}},
        {"$lookup": {
            "from": "questions",
            "localField": "question_id",
            "foreignField": "question_id",
            "as": "question",
        }},
        {"$unwind": "$question"},
        {"$group": {
            "_id": "$question.topic",
            "attempted": {"$sum": 1},
            "correct": {"$sum": {"$cond": ["$is_correct", 1, 0]}},
        }},
        {"$project": {
            "_id": 0,
            "topic": "$_id",
            "accuracy": {"$multiply": [{"$divide": ["$correct", "$attempted"]}, 100]},
        }},
        {"$match": {"accuracy": {"$lt": 60}}},
        {"$sort": {"accuracy": 1}},
        {"$limit": 3},
    ]))
    weak_topics = [item["topic"] for item in weak_topics_agg if item.get("topic")]

    return {
        "streak_days": _compute_streak(db, user_id),
        "questions_answered": total,
        "accuracy_pct": accuracy_pct,
        "last_chapter": last_chapter,
        "last_question": last_question,
        "weak_topics": weak_topics,
    }


def get_chapter_stats(db: Database, user_id: str) -> List[Dict]:
    """
    Returns per-chapter mastery stats.
    """

    pipeline = [
        {
            "$match": {
                "user_id": ObjectId(user_id)
            }
        },
        {
            "$lookup": {
                "from": "questions",
                "localField": "question_id",
                "foreignField": "question_id",
                "as": "question"
            }
        },
        {"$unwind": "$question"},
        {
            "$group": {
                "_id": "$question.chapter_id",
                "attempted": {"$sum": 1},
                "correct": {
                    "$sum": {
                        "$cond": ["$is_correct", 1, 0]
                    }
                }
            }
        },
        {
            "$project": {
                "_id": 0,
                "chapter_id": "$_id",
                "attempted": 1,
                "accuracy": {
                    "$multiply": [
                        {"$divide": ["$correct", "$attempted"]},
                        100
                    ]
                }
            }
        }
    ]

    return list(db.question_attempts.aggregate(pipeline))
