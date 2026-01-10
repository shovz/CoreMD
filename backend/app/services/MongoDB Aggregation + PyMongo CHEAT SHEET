"""
===========================================================
MongoDB Aggregation + PyMongo CHEAT SHEET (Copy/Paste)
===========================================================

This file explains:
- ObjectId & bson
- Aggregation pipelines
- MongoDB operators
- $lookup keys
- _id behavior
- $sum behavior
- User-defined vs MongoDB-defined keys
"""

# =========================================================
# 1. ObjectId & bson
# =========================================================

from bson import ObjectId
from pymongo.database import Database

# bson = Binary JSON
 - Native data format used internally by MongoDB
 - Shipped with MongoDB drivers (PyMongo, Node, etc.)

# ObjectId:
 - MongoDB's native ID type (NOT a string)
 - 12-byte binary value
 - Used for _id and references

If MongoDB stores ObjectId and you query with a string,
the query WILL NOT MATCH.

user_id = ObjectId("64f1c7d3a3e4a5b2f8c9d123")


# =========================================================
# 2. What is an Aggregation Pipeline?
# =========================================================

# An aggregation pipeline is:
 - A LIST of STAGES
 - Each stage transforms documents
 - Output of one stage feeds the next

# Executed inside MongoDB (fast, optimized)

pipeline = [
    {"$match": {...}},
    {"$lookup": {...}},
    {"$group": {...}},
    {"$project": {...}}
]

Run it like this:
 - db.collection.aggregate(pipeline)


# =========================================================
# 3. Most Used Pipeline Stages
# =========================================================

"""
$match     -> Filter documents (SQL WHERE)
$project   -> Select / compute fields (SQL SELECT)
$group     -> Aggregate data (SQL GROUP BY)
$lookup    -> Join collections (SQL JOIN)
$unwind    -> Flatten arrays
$sort      -> Sort results (ORDER BY)
$limit     -> Limit results
$skip      -> Skip results
$count     -> Count documents
$facet     -> Run multiple pipelines at once
"""


# =========================================================
# 4. $lookup (JOIN) – MongoDB Syntax
# =========================================================

lookup_stage = {
    "$lookup": {
        "from": "questions",          # foreign collection name
        "localField": "question_id",  # field in current collection
        "foreignField": "question_id",# field in foreign collection
        "as": "question"              # output array field name
    }
}

"""
$lookup keys explained:

from         -> collection to join
localField  -> field in current collection
foreignField-> field in foreign collection
as           -> output field (ARRAY)

Advanced keys (not always needed):
- pipeline
- let
- $expr
"""


# =========================================================
# 5. $group and _id behavior
# =========================================================

group_all_docs = {
    "$group": {
        "_id": None,        # GROUP EVERYTHING INTO ONE RESULT
        "count": {"$sum": 1}
    }
}

group_by_field = {
    "$group": {
        "_id": "$user_id", # GROUP BY user_id
        "count": {"$sum": 1}
    }
}

group_by_multiple_fields = {
    "$group": {
        "_id": {
            "user": "$user_id",
            "chapter": "$chapter_id"
        },
        "count": {"$sum": 1}
    }
}


# =========================================================
# 6. _id in $project
# =========================================================

project_stage = {
    "$project": {
        "_id": 0,            # EXCLUDE _id FROM OUTPUT
        "name": 1,
        "score": 1
    }
}

"""
_id options in $project:
0 -> exclude _id
1 -> include _id (default)
"""


# =========================================================
# 7. $sum Explained
# =========================================================

# Count documents
count_docs = {
    "total_attempts": {"$sum": 1}
}
Adds 1 for each document
Equivalent to SQL: COUNT(*)

# Sum a numeric field
sum_field = {
    "total_score": {"$sum": "$score"}
}

# Conditional sum (count only matching docs)
conditional_sum = {
    "correct_count": {
        "$sum": {
            "$cond": ["$is_correct", 1, 0]
        }
    }
}

"""
$sum options:
$sum: 1           -> count documents
$sum: "$field"    -> sum field values
$sum: { $cond }   -> conditional count/sum
"""


# =========================================================
# 8. Common $group Accumulators
# =========================================================

"""
$sum       -> sum or count
$avg       -> average
$min       -> minimum
$max       -> maximum
$first     -> first value in group
$last      -> last value in group
$push      -> collect values into array
$addToSet  -> collect UNIQUE values into array
"""


# =========================================================
# 9. Conditional / Logic Operators
# =========================================================

"""
$cond     -> if / else
$ifNull   -> default value
$and      -> logical AND
$or       -> logical OR
$not      -> logical NOT
$switch   -> multiple conditions
"""


# =========================================================
# 10. Arithmetic Operators
# =========================================================

'''
$add 
$subtract 
$multiply 
$divide 
$mod 
'''


# =========================================================
# 11. Comparison Operators
# =========================================================

"""
$eq   -> ==
$ne   -> !=
$gt   -> >
$gte  -> >=
$lt   -> <
$lte  -> <=
$in   -> in array
$nin  -> not in array
"""


# =========================================================
# 12. Array Operators
# =========================================================

"""
$size    -> array length
$map     -> transform array
$filter  -> filter array
$reduce  -> reduce array
$slice   -> sub-array
"""


# =========================================================
# 13. User-defined vs MongoDB-defined keys
# =========================================================

"""
MongoDB KEYWORDS (reserved):
$match, $group, $lookup, $sum, $cond

MongoDB SYNTAX KEYS:
from, localField, foreignField, as

USER-DEFINED OUTPUT FIELDS:
total_questions_answered
correct_percentage
unique_chapters_covered

User-defined fields:
- Do NOT need to exist in the database
- Are computed
- Can be named anything
"""


# =========================================================
# 14. SQL Mental Mapping
# =========================================================

"""
MongoDB        SQL
-------------------------
$match     -> WHERE
$lookup    -> JOIN
$group     -> GROUP BY
$project   -> SELECT
$cond      -> CASE WHEN
$sum: 1    -> COUNT(*)
"""


# =========================================================
# KEY TAKEAWAY
# =========================================================

"""
MongoDB Aggregation =
- SQL-style querying
- Map/Reduce-style computation
- JSON-based syntax
- Runs INSIDE MongoDB (fast, scalable)

Learn these operators and you understand ~80% of real-world pipelines.
"""
