from datetime import date, timedelta
from app.services.stats_service import calculate_streak_from_dates

def test_streak_empty():
    assert calculate_streak_from_dates([], date(2026, 5, 2)) == 0

def test_streak_active_today():
    today = date(2026, 5, 2)
    activity = [
        date(2026, 5, 2),
        date(2026, 5, 1),
        date(2026, 4, 30)
    ]
    assert calculate_streak_from_dates(activity, today) == 3

def test_streak_active_yesterday():
    today = date(2026, 5, 2)
    activity = [
        date(2026, 5, 1),
        date(2026, 4, 30),
        date(2026, 4, 29)
    ]
    assert calculate_streak_from_dates(activity, today) == 3

def test_streak_broken():
    today = date(2026, 5, 2)
    activity = [
        date(2026, 4, 30),
        date(2026, 4, 29)
    ]
    # Broken because no activity today or yesterday
    assert calculate_streak_from_dates(activity, today) == 0

def test_streak_gap_in_middle():
    today = date(2026, 5, 2)
    activity = [
        date(2026, 5, 2),
        date(2026, 5, 1),
        date(2026, 4, 29) # Gap at 4/30
    ]
    assert calculate_streak_from_dates(activity, today) == 2

def test_streak_duplicates_and_unsorted():
    today = date(2026, 5, 2)
    activity = [
        date(2026, 5, 1),
        date(2026, 5, 2),
        date(2026, 5, 1),
        date(2026, 4, 30)
    ]
    assert calculate_streak_from_dates(activity, today) == 3
