"""EUCAST facts for the dataset's organisms and antibiotics (mirrors @aei/eucast): intrinsic resistance,
no breakpoint, inference rules, specimen suitability and the effective result of an isolate.

Sources and the `check` marks are in libs/utils/eucast/src/index.ts; this file copies its tables.
"""

from __future__ import annotations

from typing import NamedTuple, Protocol

from aei.domain import REPORTED_FOR

ENTEROBACTERALES = ["Escherichia coli", "Klebsiella pneumoniae", "Klebsiella oxytoca", "Citrobacter freundii", "Proteus mirabilis"]
STAPHYLOCOCCI = ["Staphylococcus aureus", "Staphylococcus saprophyticus"]


def _each(organisms: list[str], antibiotics: list[str]) -> set[tuple[str, str]]:
    return {(o, a) for o in organisms for a in antibiotics}


# Resistant by nature (expected resistant phenotype): R whether tested or not.
INTRINSIC: frozenset[tuple[str, str]] = frozenset(
    _each(ENTEROBACTERALES, ["VAN", "CLI"])
    | _each(["Klebsiella pneumoniae", "Klebsiella oxytoca"], ["AMP"])
    | _each(["Citrobacter freundii"], ["AMP"])
    | _each(["Proteus mirabilis"], ["NIT"])
    | _each(["Pseudomonas aeruginosa"], ["AMP", "CRO", "TMP", "CXM", "VAN", "CLI"])
    | _each(["Enterococcus faecalis"], ["CXM", "CRO", "CAZ", "CLI"])
)

# No clinical breakpoint: never a treatment option for the organism.
NO_BREAKPOINT: frozenset[tuple[str, str]] = frozenset(
    _each(["Pseudomonas aeruginosa", "Enterococcus faecalis", *STAPHYLOCOCCI], ["MEC"])
    | _each(["Pseudomonas aeruginosa"], ["NIT"])
    | _each(STAPHYLOCOCCI, ["CAZ"])
    | _each(["Enterococcus faecalis"], ["MEM", "TMP"])
)

SCREEN_ONLY = ["FOX"]
STAPH_BETA_LACTAMS = ["TZP", "CXM", "CRO", "MEM"]


class HasResults(Protocol):
    organism: str
    results: dict[str, str]


class Effective(NamedTuple):
    """The result to use ("S", "R" or None) and its basis: tested, intrinsic, inferred, no-breakpoint or untested."""

    result: str | None
    basis: str


def is_intrinsic(organism: str, antibiotic: str) -> bool:
    return (organism, antibiotic) in INTRINSIC


def has_no_breakpoint(organism: str, antibiotic: str) -> bool:
    return (organism, antibiotic) in NO_BREAKPOINT


def suits_specimen(antibiotic: str, specimen: str) -> bool:
    """Urine-only antibiotics suit urine only; screens suit nothing."""
    if antibiotic in SCREEN_ONLY:
        return False
    reported = REPORTED_FOR.get(antibiotic)
    return reported is not None and (reported == "all" or reported == specimen)


def inferred_result(record: HasResults, antibiotic: str) -> str | None:
    """A result EUCAST Expert Rules let the laboratory infer from another result of the same isolate, or None."""
    organism, results = record.organism, record.results
    if organism in STAPHYLOCOCCI:
        fox = results.get("FOX")
        if fox == "R" and antibiotic in (*STAPH_BETA_LACTAMS, "AMP", "MEC", "CAZ"):
            return "R"
        if fox == "S" and antibiotic in STAPH_BETA_LACTAMS:
            return "S"
    if organism == "Enterococcus faecalis" and antibiotic == "TZP":
        return results.get("AMP")
    return None


def effective_result(record: HasResults, antibiotic: str) -> Effective:
    """Intrinsic rules first, then the laboratory's result, then inference, then no breakpoint, else untested."""
    if is_intrinsic(record.organism, antibiotic):
        return Effective("R", "intrinsic")
    tested = record.results.get(antibiotic)
    if tested:
        return Effective(tested, "tested")
    inferred = inferred_result(record, antibiotic)
    if inferred:
        return Effective(inferred, "inferred")
    if has_no_breakpoint(record.organism, antibiotic):
        return Effective(None, "no-breakpoint")
    return Effective(None, "untested")
