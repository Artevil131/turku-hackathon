"""Counting rules from surveillance practice (mirrors @aei/counting)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol, TypeVar


class Counted(Protocol):
    isolate_id: str
    patient_id: str
    organism: str
    specimen: str
    sample_date: str


R = TypeVar("R", bound=Counted)


def first_isolates(records: Sequence[R], period: tuple[str, str] | None = None) -> list[R]:
    """The first isolate of each patient, organism and specimen type within the inclusive `period` (from, to),
    in date order, ties by isolate id. Isolates outside the period are ignored."""
    in_period = [r for r in records if period is None or period[0] <= r.sample_date <= period[1]]
    # The TypeScript breaks ties with localeCompare; for the dataset's ids (C0000003-1) that is code-point order.
    in_period.sort(key=lambda r: (r.sample_date, r.isolate_id))
    seen: set[tuple[str, str, str]] = set()
    out: list[R] = []
    for r in in_period:
        key = (r.patient_id, r.organism, r.specimen)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out
