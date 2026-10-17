"""THL Finres (D-048): national susceptibility figures per genus, antibiotic and specimen type for one year, from the
public Finres cube's JSON-stat API (https://sampo.thl.fi/pivot/prod/fi/finres/lite/fact_lite). Licence CC BY 4.0,
(c) THL and the FiRe laboratory network.

    view = finres_view(fetched="2026-10-17")   # the server's /api/national data: the latest year with figures
    cell = view["cells"][0]                    # genus, antibiotic, specimen, tests, resistant, pctR, interval

Members are addressed by dimension id with a trailing dot, several joined with dots (research/guidelines.md 3);
the `L` level suffix answers 403, so every member is listed. The parser checks each returned label against the
member asked for, so an id the server resolves to something else fails loudly instead of mislabelling a cell.
"""

from __future__ import annotations

import json
import re
import urllib.request

BASE = "https://sampo.thl.fi/pivot/prod/fi/finres/lite/fact_lite"
SOURCE = "THL Finres cube (Finres kuutio, julkinen), " + BASE
LICENCE = "CC BY 4.0, (c) THL and the FiRe laboratory network"
USER_AGENT = "aei-finres/0.1 (scripts/fetch_finres.py)"

# Years by time-dimension id (fact_lite.dimensions.json: 9 = 2008 .. 26 = 2025). Add an id when THL adds a year.
YEAR_IDS: dict[int, int] = {2008 + i: 9 + i for i in range(18)}
GENUS_IDS: dict[str, int] = {"Escherichia": 56, "Klebsiella": 58, "Staphylococcus": 64, "Enterococcus": 55, "Pseudomonas": 61}
# Our antibiotic codes (@aei/domain AntibioticCode) and the three phenotype flags. Meropenem's dimension id (168) is
# resolved by the server as a time member, so it is addressed by its sid, which is unambiguous.
ANTIBIOTIC_IDS: dict[str, int] = {
    "AMP": 149, "MEC": 169, "TZP": 180, "CXM": 165, "CRO": 164, "CAZ": 162, "MEM": 45550, "CIP": 182,
    "TMP": 187, "NIT": 174, "VAN": 189, "CLI": 166, "ESBL": 153, "MRSA": 170, "VRE": 188,
}
SPECIMEN_IDS: dict[str, int] = {"urine": 195, "blood": 190, "wound": 191}
# Our specimen codes (@aei/domain Specimen) to the cube's spec_type labels.
SPECIMEN_LABELS: dict[str, str] = {"urine": "virtsa", "blood": "veri", "wound": "märkä- ja muut löydökset"}
MEASURE_IDS: dict[str, int] = {"tests": 197, "resistant": 200, "pctR": 201, "lo": 202, "hi": 203}
MEASURE_LABELS: dict[str, str] = {
    "Testien määrä": "tests",
    "R. määrä": "resistant",
    "R. osuus %": "pctR",
    "95% luottamusvälin alaraja": "lo",
    "95% luottamusvälin yläraja": "hi",
}
# The dataset's species to the genus Finres reports (D-048); species not listed have no national line.
SPECIES_GENUS: dict[str, str] = {
    "Escherichia coli": "Escherichia",
    "Klebsiella pneumoniae": "Klebsiella",
    "Klebsiella oxytoca": "Klebsiella",
    "Enterococcus faecalis": "Enterococcus",
    "Staphylococcus aureus": "Staphylococcus",
    "Pseudomonas aeruginosa": "Pseudomonas",
}
# Our antibiotic codes that Finres reports under another member: the cefoxitin screen is the MRSA flag (D-048).
ANTIBIOTIC_ALIASES: dict[str, str] = {"FOX": "MRSA"}


def _ids(ids) -> str:
    return "".join(f"{i}." for i in ids)


def cube_url(year: int) -> str:
    """One request: genus x specimen rows, antibiotic x measure columns, the year as a one-member row (so the
    response echoes its label)."""
    return (
        f"{BASE}.json?row=time-{YEAR_IDS[year]}.&row=organism-{_ids(GENUS_IDS.values())}"
        f"&row=spec_type-{_ids(SPECIMEN_IDS.values())}&column=antibiotic-{_ids(ANTIBIOTIC_IDS.values())}"
        f"&column=measure-{_ids(MEASURE_IDS.values())}"
    )


def fetch_cube(year: int) -> dict:
    """The JSON-stat dataset for one year (a User-Agent header is needed; without one THL may answer 403)."""
    req = urllib.request.Request(cube_url(year), headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)["dataset"]


def _number(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _antibiotic_code(label: str) -> str:
    m = re.search(r"\(([A-Z]+)\)\s*$", label)
    if not m or m.group(1) not in ANTIBIOTIC_IDS:
        raise ValueError(f"unexpected Finres antibiotic label {label!r}")
    return m.group(1)


def _specimen_code(label: str) -> str:
    for code, fi in SPECIMEN_LABELS.items():
        if fi == label:
            return code
    raise ValueError(f"unexpected Finres spec_type label {label!r}")


def _genus(label: str) -> str:
    if label not in GENUS_IDS:
        raise ValueError(f"unexpected Finres organism label {label!r}")
    return label


def _measure(label: str) -> str:
    if label not in MEASURE_LABELS:
        raise ValueError(f"unexpected Finres measure label {label!r}")
    return MEASURE_LABELS[label]


def _year(label: str) -> int:
    if not re.fullmatch(r"\d{4}", label):
        raise ValueError(f"unexpected Finres time label {label!r}")
    return int(label)


LABELLERS = {"time": _year, "organism": _genus, "spec_type": _specimen_code, "antibiotic": _antibiotic_code, "measure": _measure}


def parse_cells(ds: dict) -> list[dict]:
    """The cells of a JSON-stat dataset with dimensions among time, organism, spec_type, antibiotic and measure:
    one per (year, genus, antibiotic, specimen) the cube has any figure for, with None for missing measures.
    Sorted by year, specimen, genus and antibiotic in the order of the id tables."""
    dims, sizes = ds["dimension"]["id"], ds["dimension"]["size"]
    unknown = set(dims) - set(LABELLERS)
    if unknown:
        raise ValueError(f"unexpected Finres dimensions {sorted(unknown)}")
    axes = []
    for d in dims:
        cat = ds["dimension"][d]["category"]
        order = sorted(cat["index"], key=lambda k: cat["index"][k])
        axes.append([LABELLERS[d](cat.get("label", {}).get(k, k)) for k in order])
    values = ds["value"]
    items = values.items() if isinstance(values, dict) else ((str(i), v) for i, v in enumerate(values) if v is not None)
    grouped: dict[tuple, dict[str, float | None]] = {}
    for flat, value in items:
        rest, coords = int(flat), {}
        for d, size, axis in zip(reversed(dims), reversed(sizes), reversed(axes), strict=True):
            rest, i = divmod(rest, size)
            coords[d] = axis[i]
        key = (coords.get("time"), coords["organism"], coords["antibiotic"], coords["spec_type"])
        grouped.setdefault(key, {})[coords["measure"]] = _number(value)
    genus_rank = {g: i for i, g in enumerate(GENUS_IDS)}
    ab_rank = {a: i for i, a in enumerate(ANTIBIOTIC_IDS)}
    sp_rank = {s: i for i, s in enumerate(SPECIMEN_IDS)}
    cells = []
    for (year, genus, antibiotic, specimen), m in sorted(
        grouped.items(), key=lambda kv: (kv[0][0] or 0, sp_rank[kv[0][3]], genus_rank[kv[0][1]], ab_rank[kv[0][2]])
    ):
        tests, resistant = m.get("tests"), m.get("resistant")
        lo, hi = m.get("lo"), m.get("hi")
        cell = {
            "genus": genus,
            "antibiotic": antibiotic,
            "specimen": specimen,
            "tests": None if tests is None else int(tests),
            "resistant": None if resistant is None else int(resistant),
            "pctR": m.get("pctR"),
            "interval": None if lo is None or hi is None else [lo, hi],
        }
        if year is not None:
            cell["year"] = year
        cells.append(cell)
    return cells


def view_from_cells(cells: list[dict], *, year: int, fetched: str) -> dict:
    """The file /api/national serves: provenance, the year and that year's cells (without the per-cell year)."""
    return {
        "source": SOURCE,
        "licence": LICENCE,
        "fetched": fetched,
        "year": year,
        "cells": [{k: v for k, v in c.items() if k != "year"} for c in cells if c.get("year", year) == year],
    }


def finres_view(*, fetched: str, fetch=fetch_cube) -> dict:
    """The latest year that has any figure, newest first; raises when no year has one."""
    for year in sorted(YEAR_IDS, reverse=True):
        cells = parse_cells(fetch(year))
        if cells:
            return view_from_cells(cells, year=year, fetched=fetched)
    raise RuntimeError("Finres returned no figures for any year")


def national_cell(view: dict, organism: str, antibiotic: str, specimen: str) -> dict | None:
    """The national cell for one of our species, antibiotic codes and specimens, or None (no national line)."""
    genus = SPECIES_GENUS.get(organism)
    code = ANTIBIOTIC_ALIASES.get(antibiotic, antibiotic)
    if genus is None:
        return None
    return next(
        (c for c in view["cells"] if c["genus"] == genus and c["antibiotic"] == code and c["specimen"] == specimen),
        None,
    )
