"""Experiment 0021: the naming rule of README.md ("Naming rule"): an ordered list of tests on the fields of an alert's first
signal that gives its kind (ENGINE.md 3.6) and its sentence in English and Finnish, and says which slots of the sentence no
field or setting fills. Reads `Signal.detector`, `ward`, `organism`, `phenotype`, `antibiotic`, `observed`, `expected`, `p`;
never `key` and never `profile` (0015 overloads it with its budget mask).

    rule 1  the alert is a CPE find                       sentinel
    rule 2  p absent (a rule, no test)                    sentinel
    rule 3  antibiotic set, ward absent                   trend
    rule 4  antibiotic set, ward set                      divergence
    rule 5  organism, phenotype, antibiotic all absent    data
    rule 6  organism or phenotype set, expected set       cluster
    rule 7  none of these                                 unnamed
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from functools import lru_cache

from aei import harness
from aei.dataset import IsolateRecord
from aei.detect import Signal

KINDS = ("sentinel", "cluster", "trend", "divergence", "data")
PHENOTYPE_LABEL = {"esbl": "ESBL", "mrsa": "MRSA", "vre": "VRE", "cpe": "CPE"}
# window of the cluster tests in days, by detector name (a detector setting, not a Signal field); lookback of new-in-unit
WINDOW_DAYS = {"profile-excess": 28, "phenotype-excess": 28, "gamma-poisson": 7}
LOOKBACK_DAYS = {"new-in-unit": 180}
FIRST_STEP = {  # proposed (overnight), pending Artem: the first-step texts belong to method 28 and are not scored here
    "sentinel": ("Eristä ja seulo", "Isolate and screen"),
    "cluster": ("Eristä ja seulo", "Isolate and screen"),
    "trend": ("Tarkista hoitosuositus", "Review the guideline"),
    "divergence": ("Vertaa yksikön käytäntöjä", "Review the unit's practice"),
    "data": ("Tarkista tiedonsiirto", "Check the feed"),
    "unnamed": ("", ""),
}


def kind_of_signal(s: Signal) -> str:
    """Rules 2 to 7 on a signal (rule 1 is for CPE finds, which are not signals)."""
    if s.p is None:
        return "sentinel"
    if s.antibiotic is not None:
        return "trend" if s.ward is None else "divergence"
    if s.organism is None and s.phenotype is None:
        return "data"
    if s.expected is not None:
        return "cluster"
    return "unnamed"


@lru_cache(maxsize=1)
def wards() -> dict[str, tuple[str, str]]:
    with (harness.DATA / "wards.csv").open(encoding="utf-8-sig", newline="") as f:
        return {r["ward_code"]: (r["ward_fi"], r["ward_en"]) for r in csv.DictReader(f)}


@dataclass
class Named:
    kind: str
    en: str
    fi: str
    missing: list[str] = field(default_factory=list)  # slots that no field or setting fills
    rule: int = 0


def _fmt(x: float, digits: int = 1) -> str:
    return f"{x:.{digits}f}"


def _plural(n: float, one: str, many: str) -> str:
    return one if n == 1 else many


def name_signal(s: Signal) -> Named:
    """The kind and the two sentences of an alert whose first signal is `s`, with the slots nothing fills printed as "—"."""
    kind = kind_of_signal(s)
    fi_u, en_u = wards().get(s.ward or "", (s.ward or "—", s.ward or "—"))
    label = PHENOTYPE_LABEL.get(s.phenotype or "", None) or s.organism or "—"
    miss: list[str] = []
    if kind == "sentinel":
        look = LOOKBACK_DAYS.get(s.detector)
        if look is None:
            miss.append("lookback")
        lk = "—" if look is None else str(look)
        rule = 2
        return Named(kind, f"First {label} in {en_u} in {lk} days", f"Ensimmäinen {label} yksikössä {fi_u} {lk} päivään", miss, rule)
    if kind == "trend":
        miss += ["start", "span"]
        share = "—" if s.observed is None else f"{100 * s.observed:.0f}"
        ab = s.antibiotic
        return Named(kind, f"{s.organism} {ab} resistance rising: — → {share}% over —", f"{s.organism} {ab} -resistenssi nousussa: — → {share} % ajalla —", miss, 3)
    if kind == "divergence":
        o, e = 100 * s.observed, 100 * s.expected
        return Named(kind, f"{en_u} {s.antibiotic} resistance in {s.organism} above hospital: {o:.0f}% against {e:.0f}%",
                     f"{fi_u}: {s.organism} {s.antibiotic} -resistenssi yli sairaalan tason: {o:.0f} % vs {e:.0f} %", miss, 4)
    if kind == "data":
        if s.detector == "empty-run":
            return Named(kind, f"{en_u}: no samples for {int(s.observed)} {_plural(s.observed, 'day', 'days')}", f"{fi_u}: ei näytteitä {int(s.observed)} päivään", miss, 5)
        e = f"{s.expected:.0f}"
        return Named(kind, f"{en_u}: {int(s.observed)} cultures in 7 days, usual {e}", f"{fi_u}: {int(s.observed)} viljelyä 7 päivässä, tavallisesti {e}", miss, 5)
    if kind == "cluster":
        days = WINDOW_DAYS.get(s.detector)
        if days is None:
            miss.append("weeks")
        wk = "—" if days is None else f"{days // 7}"
        e_en, e_fi = _fmt(s.expected), _fmt(s.expected).replace(".", ",")
        n = int(s.observed)
        wk_en = "week" if days == 7 else "weeks"
        return Named(kind, f"{label} in {en_u}: {n} isolates in {wk} {wk_en}, usual {e_en}",
                     f"{label} yksikössä {fi_u}: {n} eristettä {wk} viikossa, tavallisesti {e_fi}", miss, 6)
    return Named("unnamed", "", "", miss, 7)


def name_cpe(r: IsolateRecord) -> Named:
    """Rule 1: a CPE find (D-014)."""
    fi_u, en_u = wards().get(r.ward, (r.ward, r.ward))
    return Named("sentinel", f"CPE {r.organism} in {en_u}", f"CPE ({r.organism}) yksikössä {fi_u}", [], 1)
