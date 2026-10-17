"""Experiment 0021: alerts, the patients behind them, and the incident rules R1 to R7 of README.md ("Incident rules").

An alert joins the first open incident that meets the rule; the incident carries the union of its alerts' units, tags and patients
and its latest date (D-034's form, `aei.score_detection.group_incidents`; R1 must give the same partition). Single-linkage in
time order: an alert is linked to an incident through the incident's latest alert (window) and through any member (tags, patients).
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field

import naming

from aei import score_detection as sd
from aei.dataset import IsolateRecord
from aei.dates import add_days, days_between
from aei.detect import Signal

EVIDENCE_DAYS = 28  # patients behind an alert: its unit's isolates of its organism or phenotype in the 28 days up to its first signal


@dataclass
class A:
    """An alert: one episode of a detector (on its first signal), a new-in-unit alert, or a CPE find."""

    id: str
    date: str
    ward: str | None
    source: str  # "detector", "new-in-unit", "cpe"
    organism: str | None
    phenotype: str | None
    signal: Signal | None  # first signal (None for a CPE find)
    group: list[Signal] = field(default_factory=list)  # all signals of the episode
    isolate: IsolateRecord | None = None
    name: naming.Named | None = None

    @property
    def sampling(self) -> bool:
        return self.name is not None and self.name.kind == "data"

    def as_sd(self) -> sd.Alert:
        kind = {"detector": "detector", "new-in-unit": "new-in-unit", "cpe": "cpe"}[self.source]
        return sd.Alert(self.id, self.date, self.ward, kind, self.organism, self.phenotype, self.sampling)


def alerts_from(detector, signals: Sequence[Signal]) -> list[A]:
    """One alert per group of `detector.alert_groups(signals)`, on the group's first signal (as `sd.alerts_of`, same ids),
    named by the rule."""
    out = []
    for g in detector.alert_groups(signals):
        s = g[0]
        if s.detector == "new-in-unit":
            out.append(A(f"new:{s.phenotype}:{s.ward}:{s.date}", s.date, s.ward, "new-in-unit", s.organism, s.phenotype, s, list(g), None, naming.name_signal(s)))
        else:
            out.append(A(f"detector:{s.detector}:{s.key}:{s.date}", s.date, s.ward, "detector", s.organism, s.phenotype, s, list(g), None, naming.name_signal(s)))
    return out


def cpe_from(records: Sequence[IsolateRecord]) -> list[A]:
    """Every CPE isolate is an alert on its sample date (D-014), named by rule 1."""
    return [A(f"cpe:{r.isolate_id}", r.sample_date, r.ward, "cpe", r.organism, None, None, [], r, naming.name_cpe(r)) for r in records if "cpe" in r.phenotypes]


class Evidence:
    """Patients behind an alert, from the records dated up to the alert's date only."""

    def __init__(self, records: Sequence[IsolateRecord]):
        by: dict[str, list[IsolateRecord]] = defaultdict(list)
        for r in records:
            by[r.ward].append(r)
        self.by = {w: (sorted(rs, key=lambda r: r.sample_date)) for w, rs in by.items()}
        self.dates = {w: [r.sample_date for r in rs] for w, rs in self.by.items()}

    def patients(self, a: A) -> set[str]:
        if a.source == "cpe":
            return {a.isolate.patient_id} if a.isolate else set()
        s = a.signal
        if s is None or a.sampling or a.ward not in self.by:
            return set()
        lo = a.date if a.source == "new-in-unit" else add_days(a.date, -(EVIDENCE_DAYS - 1))
        dates = self.dates[a.ward]
        out = set()
        for r in self.by[a.ward][bisect_left(dates, lo) : bisect_right(dates, a.date)]:
            if a.source == "new-in-unit":
                ok = s.phenotype in r.phenotypes and r.organism == s.organism
            elif s.phenotype is not None:
                ok = s.phenotype in r.phenotypes
            elif s.organism is not None:
                ok = r.organism == s.organism
            else:
                ok = False
            if not ok:
                continue
            out.add(r.patient_id)
        return out


def tags(a: A) -> list[str]:
    """D-034's tags: sampling alerts share one; an organism; a phenotype and the organisms that carry it."""
    if a.sampling:
        return ["sampling"]
    out = []
    if a.organism:
        out.append(f"org:{a.organism}")
    if a.phenotype:
        out.append(f"ph:{a.phenotype}")
        out += [f"org:{o}" for o in sd.CARRIERS_OF[a.phenotype]]
    if a.source == "cpe":
        out.append("ph:cpe")
    return out


@dataclass(frozen=True)
class Rule:
    key: str
    text: str
    window: int
    link: Callable[[bool, bool, bool], bool]  # (same unit, shares a tag, shares a patient) -> linked


RULES = [
    Rule("R1", "D-034: same unit and a shared organism or phenotype, 28 d", 28, lambda u, t, p: u and t),
    Rule("R2", "as R1, 14 d", 14, lambda u, t, p: u and t),
    Rule("R3", "as R1, 56 d", 56, lambda u, t, p: u and t),
    Rule("R4", "same unit only, 28 d", 28, lambda u, t, p: u),
    Rule("R5", "shared organism or phenotype in any unit, 28 d", 28, lambda u, t, p: t),
    Rule("R6", "shared patient in any unit, 28 d", 28, lambda u, t, p: p),
    Rule("R7", "R1 or R6, 28 d", 28, lambda u, t, p: (u and t) or p),
]
RULE_BY_KEY = {r.key: r for r in RULES}


def group(alerts: Sequence[A], rule: Rule, patients: dict[str, set[str]] | None = None) -> dict[str, str]:
    """alert id -> incident id (the first alert's id), alerts in date and id order, under `rule`."""
    patients = patients or {}
    open_: list[dict] = []
    out: dict[str, str] = {}
    for a in sorted(alerts, key=lambda a: (a.date, a.id)):
        t = set(tags(a))
        pa = patients.get(a.id, set())
        hit = None
        for i in open_:
            if days_between(i["last"], a.date) > rule.window:
                continue
            same_unit = a.ward is not None and i["ward"] == a.ward
            if rule.link(same_unit, bool(t & i["tags"]), bool(pa & i["patients"])):
                hit = i
                break
        if hit is not None:
            hit["last"] = a.date
            hit["tags"] |= t
            hit["patients"] |= pa
            hit["members"].append(a)
            out[a.id] = hit["id"]
        else:
            open_.append({"id": a.id, "ward": a.ward, "tags": set(t), "patients": set(pa), "last": a.date, "first": a.date, "members": [a]})
            out[a.id] = a.id
    return out


def incident_stats(alerts: Sequence[A], inc: dict[str, str], zone_of: Callable[[A], str | None]) -> dict:
    """Counts of the grouping: incidents, the planted zones' alerts and the incidents they fall into, incidents that mix a
    zone with outside alerts or two zones, incidents over more than one unit, the longest incident in days."""
    members: dict[str, list[A]] = defaultdict(list)
    for a in alerts:
        members[inc[a.id]].append(a)
    zones: dict[str, set[str]] = defaultdict(set)
    zone_alerts: dict[str, int] = defaultdict(int)
    mixed = multi_unit = 0
    longest = 0
    for iid, ms in members.items():
        labels = {zone_of(a) or "outside" for a in ms}
        for a in ms:
            z = zone_of(a)
            if z:
                zones[z].add(iid)
                zone_alerts[z] += 1
        if len(labels) > 1:
            mixed += 1
        if len({a.ward for a in ms}) > 1:
            multi_unit += 1
        ds = sorted(a.date for a in ms)
        longest = max(longest, days_between(ds[0], ds[-1]))
    return {
        "alerts": len(alerts),
        "incidents": len(members),
        "zone_alerts": dict(sorted(zone_alerts.items())),
        "zone_incidents": {z: len(v) for z, v in sorted(zones.items())},
        "mixed_incidents": mixed,
        "multi_unit_incidents": multi_unit,
        "longest_days": longest,
    }
