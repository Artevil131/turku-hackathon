"""Calendar-day arithmetic on ISO dates, YYYY-MM-DD strings (mirrors @aei/replay dates.ts)."""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache


@lru_cache(maxsize=1 << 16)
def add_days(day: str, days: int) -> str:
    """The ISO date `days` after `day` (negative: before)."""
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()


@lru_cache(maxsize=1 << 16)
def days_between(start: str, end: str) -> int:
    """Whole days from `start` to `end` (negative when `end` is earlier)."""
    return (date.fromisoformat(end) - date.fromisoformat(start)).days
