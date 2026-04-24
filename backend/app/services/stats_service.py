from datetime import datetime, timedelta

from bson import ObjectId
from pymongo.database import Database
from typing import Dict, List


def _compute_streak(db: Database, user_id: str) -> int:
    """Count consecutive calendar days (UTC) ending today with ≥1 question attempt."""
    pipeline = [
        {"$match": {"user_id": ObjectId(user_id)}},
        {"$project": {"date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}}},
        {"$group": {"_id": "$date"}},
        {"$sort": {"_id": -1}},
    ]
    dates = [doc["_id"] for doc in db.question_attempts.aggregate(pipeline)]
    if not dates:
        return 0
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    if dates[0] != today_str:
        return 0
    streak = 0
    expected = datetime.utcnow().date()
    for date_str in dates:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        if d == expected:
            streak += 1
            expected -= timedelta(days=1)
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
    data = result[0] if result else {
        "total_questions_answered": 0,
        "correct_percentage": 0,
        "unique_chapters_covered": 0,
    }
    data["current_streak"] = _compute_streak(db, user_id)
    return data


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
