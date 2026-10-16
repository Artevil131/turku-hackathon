"""Patient flows between units (D-011) and phenotype carrier trails (D-012), mirroring @aei/relations.

Pass every culture as the samples (negative ones too) and the isolate records as the finds.

    flows = patient_flows(cultures, ("2025-01-01", "2025-12-31"))
    trails = phenotype_trails(cultures, records)
    links, arrivals = trail_links(trails), carrier_arrivals(trails)
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from aei.dates import add_days, days_between
from aei.domain import PHENOTYPES

DEFAULT_CARRIER_DAYS = 90

Window = tuple[str, str]  # inclusive (from, to), ISO dates


class Sample(Protocol):
    culture_id: str
    patient_id: str
    sample_date: str
    ward: str


class Find(Protocol):
    culture_id: str
    organism: str
    phenotypes: Sequence[str]


@dataclass(slots=True)
class Move:
    patient_id: str
    source: str
    to: str
    date: str


@dataclass(slots=True)
class Flow:
    source: str
    to: str
    patients: int


@dataclass(slots=True)
class TrailStep:
    culture_id: str
    date: str
    ward: str
    organisms: list[str]
    carried_from: str | None
    found_on: str | None


@dataclass(slots=True)
class PatientTrail:
    patient_id: str
    phenotype: str
    steps: list[TrailStep]


@dataclass(slots=True)
class TrailLink:
    source: str
    to: str
    phenotype: str
    patients: int
    confirmed: int


@dataclass(slots=True)
class CarrierArrival:
    patient_id: str
    phenotype: str
    culture_id: str
    date: str
    ward: str
    source: str
    found_on: str
    confirmed: bool


def in_window(date: str, window: Window | None) -> bool:
    return window is None or window[0] <= date <= window[1]


def samples_by_patient(samples: Sequence[Sample]) -> dict[str, list]:
    """Each patient's samples in time order (date, then culture id), patients in order of first appearance."""
    out: dict[str, list] = {}
    for s in samples:
        out.setdefault(s.patient_id, []).append(s)
    for items in out.values():
        items.sort(key=lambda s: (s.sample_date, s.culture_id))
    return out


def patient_moves(samples: Sequence[Sample]) -> list[Move]:
    """A patient's sample in unit B whose previous sample was in unit A is a move A -> B, dated by B's sample."""
    moves = []
    for patient, items in samples_by_patient(samples).items():
        for prev, nxt in zip(items, items[1:]):
            if prev.ward != nxt.ward:
                moves.append(Move(patient, prev.ward, nxt.ward, nxt.sample_date))
    return moves


def count_flows(moves: Sequence[Move], window: Window | None = None) -> list[Flow]:
    """Moves dated in `window`, counted once per patient; strongest first, ties by unit codes."""
    pairs: dict[tuple[str, str], set[str]] = {}
    for m in moves:
        if in_window(m.date, window):
            pairs.setdefault((m.source, m.to), set()).add(m.patient_id)
    flows = [Flow(a, b, len(ids)) for (a, b), ids in pairs.items()]
    # localeCompare on the unit codes orders them as code points do.
    return sorted(flows, key=lambda f: (-f.patients, f.source, f.to))


def patient_flows(samples: Sequence[Sample], window: Window | None = None) -> list[Flow]:
    return count_flows(patient_moves(samples), window)


def phenotype_trails(
    samples: Sequence[Sample],
    finds: Sequence[Find],
    window: Window | None = None,
    max_days: int = DEFAULT_CARRIER_DAYS,
    phenotype: str | None = None,
) -> list[PatientTrail]:
    """A patient with a phenotype found in unit A who is later sampled in unit B within `max_days` of the latest
    find is a carrier moving A -> B. Keeps trails with a step in `window`."""
    phenotypes = [phenotype] if phenotype else PHENOTYPES
    context = (add_days(window[0], -max_days), window[1]) if window else None
    found: dict[str, dict[str, list[str]]] = {}
    for f in finds:
        for p in f.phenotypes:
            organisms = found.setdefault(f.culture_id, {}).setdefault(p, [])
            if f.organism not in organisms:
                organisms.append(f.organism)
    trails = []
    for patient, items in samples_by_patient(samples).items():
        for ph in phenotypes:
            steps: list[TrailStep] = []
            latest: tuple[str, str] | None = None  # ward, date
            for s in items:
                if not in_window(s.sample_date, context):
                    continue
                organisms = found.get(s.culture_id, {}).get(ph, [])
                carried = latest if latest and latest[0] != s.ward and days_between(latest[1], s.sample_date) <= max_days else None
                if organisms or carried:
                    steps.append(
                        TrailStep(s.culture_id, s.sample_date, s.ward, organisms, carried[0] if carried else None, carried[1] if carried else None)
                    )
                if organisms:
                    latest = (s.ward, s.sample_date)
            if any(in_window(step.date, window) for step in steps):
                trails.append(PatientTrail(patient, ph, steps))
    return trails


def carrier_arrivals(trails: Sequence[PatientTrail], window: Window | None = None) -> list[CarrierArrival]:
    """Every carrier move dated in `window`, newest first (ties by culture id)."""
    out = [
        CarrierArrival(t.patient_id, t.phenotype, s.culture_id, s.date, s.ward, s.carried_from, s.found_on, len(s.organisms) > 0)
        for t in trails
        for s in t.steps
        if s.carried_from and s.found_on and in_window(s.date, window)
    ]
    out.sort(key=lambda a: a.culture_id)
    out.sort(key=lambda a: a.date, reverse=True)  # stable: ties keep culture-id order
    return out


def trail_links(trails: Sequence[PatientTrail], window: Window | None = None) -> list[TrailLink]:
    """Carrier moves between units dated in `window`, counted per patient; strongest first, ties by unit codes."""
    links: dict[tuple[str, str, str], tuple[set[str], set[str]]] = {}
    for t in trails:
        for s in t.steps:
            if not s.carried_from or not in_window(s.date, window):
                continue
            ids, confirmed = links.setdefault((s.carried_from, s.ward, t.phenotype), (set(), set()))
            ids.add(t.patient_id)
            if s.organisms:
                confirmed.add(t.patient_id)
    out = [TrailLink(a, b, ph, len(ids), len(conf)) for (a, b, ph), (ids, conf) in links.items()]
    return sorted(out, key=lambda x: (-x.patients, x.source, x.to))
