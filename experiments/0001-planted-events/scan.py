"""0001: describe the dataset to look for planted events (README.md).

Run from the repository root:
    uv run python experiments/0001-planted-events/scan.py
Writes Markdown tables to experiments/0001-planted-events/out/.
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from datetime import date as Date
from pathlib import Path

from aei.dataset import IsolateRecord, load_records
from aei.dates import add_days, days_between
from aei.detect import profile_of
from aei.domain import ANTIBIOTICS, PHENOTYPES, UNITS
from aei.jscompat import js_round, table, to_fixed
from aei.relations import carrier_arrivals, phenotype_trails, trail_links

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0001-planted-events/out")

records, cultures = load_records(DATA)

# ---------- helpers ----------

week_of: dict[str, str] = {}
for c in cultures:
    week_of[c.sample_date] = f"{c.iso_year}-W{c.iso_week:02d}"


def week(day: str) -> str:
    if day in week_of:
        return week_of[day]
    y, w, _ = Date.fromisoformat(day).isocalendar()
    return f"{y}-W{w:02d}"


WEEKS = sorted({week(c.sample_date) for c in cultures})


def quarter(day: str) -> str:
    return f"{day[:4]}-Q{(int(day[5:7]) - 1) // 3 + 1}"


def median(xs: list[int]) -> float:
    s = sorted(xs)
    m = len(s) >> 1
    if not s:
        return 0
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def pct(k: int, n: int) -> str:
    return f"{to_fixed((100 * k) / n, 1)} % ({k}/{n})" if n else "–"


def weekly(items: list[tuple[str, str]]) -> dict[str, dict[str, int]]:
    """unit (or "ALL") -> week -> count, every week present."""
    out = {u: dict.fromkeys(WEEKS, 0) for u in [*UNITS, "ALL"]}
    for day, unit in items:
        w = week(day)
        for u in (unit, "ALL"):
            out[u][w] = out[u].get(w, 0) + 1
    return out


def series_summary(name: str, series: dict[str, dict[str, int]]) -> str:
    rows = []
    for unit, by_week in series.items():
        # Skip the partial first and last weeks of the dataset.
        values = [(w, by_week.get(w, 0)) for w in WEEKS[1:-1]]
        counts = [n for _, n in values]
        high = sorted(values, key=lambda v: -v[1])
        low = sorted(values, key=lambda v: v[1])
        rows.append(
            [
                unit,
                sum(counts),
                median(counts),
                ", ".join(f"{w}: {n}" for w, n in high[:3]),
                ", ".join(f"{w}: {n}" for w, n in low[:2]),
                sum(1 for n in counts if n == 0),
            ]
        )
    return f"### {name}\n\n{table(['unit', 'total', 'median / week', 'highest weeks', 'lowest weeks', 'weeks with 0'], rows)}\n"


# ---------- 1. weekly volumes and phenotype counts ----------

positive = [c for c in cultures if c.result != "negative"]
s1 = "# 1. Weekly counts per unit\n\nAll weeks except the partial first and last. Counts are measured.\n\n"
s1 += series_summary("Cultures", weekly([(c.sample_date, c.ward) for c in cultures]))
s1 += series_summary("Positive or mixed-growth cultures", weekly([(c.sample_date, c.ward) for c in positive]))
s1 += series_summary("Isolates", weekly([(r.sample_date, r.ward) for r in records]))
for p in PHENOTYPES:
    s1 += series_summary(f"Isolates flagged {p.upper()}", weekly([(r.sample_date, r.ward) for r in records if p in r.phenotypes]))
# Positivity per quarter, a cheap check for a change in how samples were taken.
pos_rows = []
for q in sorted({quarter(c.sample_date) for c in cultures}):
    in_q = [c for c in cultures if quarter(c.sample_date) == q]
    pos_rows.append([q, len(in_q), pct(sum(1 for c in in_q if c.result != "negative"), len(in_q))])
s1 += f"### Positivity per quarter, all units\n\n{table(['quarter', 'cultures', 'positive or mixed'], pos_rows)}\n"

# ---------- 2. every CPE and VRE isolate ----------

s2 = "# 2. Every CPE and VRE isolate\n\n"
for p in ("cpe", "vre"):
    found = sorted((r for r in records if p in r.phenotypes), key=lambda r: r.sample_date)
    s2 += f"### {p.upper()}: {len(found)} isolates, {len({r.patient_id for r in found})} patients (measured)\n\n"
    s2 += table(
        ["date", "unit", "organism", "specimen", "patient", "stay day", "other flags"],
        [
            [
                r.sample_date,
                r.ward,
                r.organism,
                r.specimen,
                r.patient_id,
                days_between(r.admission_date, r.sample_date) + 1 if r.admission_date else "out",
                ", ".join(x for x in r.phenotypes if x != p) or "–",
            ]
            for r in found
        ],
    )
    # Gaps between consecutive finds, per unit, to see bursts.
    by_unit: dict[str, list[str]] = {}
    for r in found:
        by_unit.setdefault(r.ward, []).append(r.sample_date)
    parts = []
    for u, ds in by_unit.items():
        most = max(sum(1 for d in ds if first <= d <= add_days(first, 27)) for first in ds)
        parts.append(f"{u} {len(ds)} (most within 28 days: {most})")
    s2 += f"\n\nPer unit: {'; '.join(parts)}\n\n"

# ---------- 3. resistance per year, quarter and around 1 January ----------

PAIRS: list[tuple[str, str, str | None]] = [
    ("Escherichia coli", "AMP", None),
    ("Escherichia coli", "MEC", "urine"),
    ("Escherichia coli", "TMP", "urine"),
    ("Escherichia coli", "NIT", "urine"),
    ("Escherichia coli", "CIP", None),
    ("Escherichia coli", "CXM", None),
    ("Escherichia coli", "CRO", None),
    ("Escherichia coli", "TZP", None),
    ("Escherichia coli", "MEM", None),
    ("Klebsiella pneumoniae", "CRO", None),
    ("Klebsiella pneumoniae", "CIP", None),
    ("Klebsiella pneumoniae", "TZP", None),
    ("Klebsiella pneumoniae", "MEM", None),
    ("Pseudomonas aeruginosa", "CAZ", None),
    ("Pseudomonas aeruginosa", "TZP", None),
    ("Pseudomonas aeruginosa", "MEM", None),
    ("Pseudomonas aeruginosa", "CIP", None),
    ("Staphylococcus aureus", "FOX", None),
    ("Staphylococcus aureus", "CLI", None),
    ("Enterococcus faecalis", "AMP", None),
    ("Enterococcus faecalis", "VAN", None),
    ("Proteus mirabilis", "CIP", None),
]


def tested(o: str, a: str, specimen: str | None) -> list[IsolateRecord]:
    return [r for r in records if r.organism == o and (not specimen or r.specimen == specimen) and a in r.results]


def r_of(items: list[IsolateRecord], a: str) -> int:
    return sum(1 for r in items if r.results.get(a) == "R")


YEARS = ["2023", "2024", "2025", "2026"]
s3 = "# 3. Resistance over time\n\nAll isolates, no first-isolate rule. Percentages are computed, counts measured.\n\n"
s3 += "### Per calendar year (2023 is Oct–Dec only, 2026 Jan–Sep)\n\n"
rows3 = []
for o, a, sp in PAIRS:
    items = tested(o, a, sp)
    by_year = [[r for r in items if r.sample_date.startswith(y)] for y in YEARS]
    rows3.append([o, a, sp or "all", *(pct(r_of(ys, a), len(ys)) for ys in by_year)])
s3 += table(["organism", "antibiotic", "specimen", *YEARS], rows3)
s3 += "\n\n### Eight weeks before and after each 1 January (guideline version change)\n\n"
BOUNDARIES = ["2024-01-01", "2025-01-01", "2026-01-01"]
rows3 = []
for o, a, sp in PAIRS:
    items = tested(o, a, sp)
    cells = []
    for b in BOUNDARIES:
        before = [r for r in items if add_days(b, -56) <= r.sample_date < b]
        after = [r for r in items if b <= r.sample_date < add_days(b, 56)]
        cells += [pct(r_of(before, a), len(before)), pct(r_of(after, a), len(after))]
    rows3.append([o, a, sp or "all", *cells])
s3 += table(["organism", "antibiotic", "specimen", *(x for b in BOUNDARIES for x in (f"before {b[:4]}", f"after {b[:4]}"))], rows3)

QUARTERS = sorted({quarter(r.sample_date) for r in records})
s3 += "\n\n### Per quarter and unit, for the pairs most used empirically\n\n"
UNIT_PAIRS: list[tuple[str, str, str | None]] = [
    ("Escherichia coli", "CIP", None),
    ("Escherichia coli", "CRO", None),
    ("Escherichia coli", "TMP", "urine"),
    ("Klebsiella pneumoniae", "CRO", None),
    ("Staphylococcus aureus", "FOX", None),
]
for o, a, sp in UNIT_PAIRS:
    items = tested(o, a, sp)
    s3 += f"\n#### {o} · {a}{f' · {sp}' if sp else ''} (% R, n)\n\n"
    rows3 = []
    for u in [*UNITS, "ALL"]:
        in_u = items if u == "ALL" else [r for r in items if r.ward == u]
        cells = []
        for q in QUARTERS:
            in_q = [r for r in in_u if quarter(r.sample_date) == q]
            cells.append(f"{js_round((100 * r_of(in_q, a)) / len(in_q))} ({len(in_q)})" if in_q else "–")
        rows3.append([u, *cells])
    s3 += table(["unit", *QUARTERS], rows3)
    s3 += "\n"

# ---------- 4. identical profiles concentrated in a unit ----------

profile_count: dict[str, int] = {}
of_organism: dict[str, int] = {}
for r in records:
    k = f"{r.organism}|{profile_of(r)}"
    profile_count[k] = profile_count.get(k, 0) + 1
    of_organism[r.organism] = of_organism.get(r.organism, 0) + 1

groups: dict[str, list[IsolateRecord]] = {}
for r in records:
    groups.setdefault(f"{r.ward}|{r.organism}|{profile_of(r)}", []).append(r)
cluster_rows = []
for key, items in groups.items():
    unit, organism, prof = key.split("|")
    items.sort(key=lambda r: r.sample_date)
    dates = [r.sample_date for r in items]
    best = (0, "", 0)  # patients, start, of them day 3+
    for first in items:
        in_win = items[bisect_left(dates, first.sample_date) : bisect_right(dates, add_days(first.sample_date, 27))]
        patients = len({r.patient_id for r in in_win})
        if patients > best[0]:
            ha = len({r.patient_id for r in in_win if r.admission_date and days_between(r.admission_date, r.sample_date) >= 2})
            best = (patients, first.sample_date, ha)
    overall = profile_count[f"{organism}|{prof}"]
    cluster_rows.append((unit, organism, prof, best[0], best[1], overall, overall / of_organism[organism], best[2]))
s4 = (
    f"# 4. Identical S/R profiles concentrated in one unit within 28 days\n\nProfile letters follow {' '.join(ANTIBIOTICS)}; "
    '"." is not tested. "share" is how common the profile is among all isolates of the organism (computed). Rows ranked by '
    "distinct patients among profiles held by under 5 % of the organism's isolates.\n\n"
)
ranked = sorted((r for r in cluster_rows if r[6] < 0.05 and r[3] >= 3), key=lambda r: (-r[3], r[6]))
s4 += table(
    ["unit", "organism", "profile", "patients in 28 days", "from", "of them day 3+ of stay", "profile overall", "share"],
    [[u, o, f"`{p}`", n, start, ha, overall, f"{to_fixed(100 * share, 2)} %"] for u, o, p, n, start, overall, share, ha in ranked[:40]],
)

# ---------- 5. carrier links ----------

trails = phenotype_trails(cultures, records)
links = trail_links(trails)
arrivals = carrier_arrivals(trails)
s5 = (
    f"# 5. Carrier trails (D-012)\n\n{len(trails)} trails, {len(links)} links, {len(arrivals)} carrier moves, "
    f"{sum(1 for a in arrivals if a.confirmed)} confirmed in the new unit (computed).\n\n"
)
s5 += table(["from", "to", "phenotype", "patients", "confirmed"], [[x.source, x.to, x.phenotype, x.patients, x.confirmed] for x in links[:15]])
per_quarter = [[q, *(sum(1 for a in arrivals if a.phenotype == p and quarter(a.date) == q) for p in PHENOTYPES)] for q in QUARTERS]
s5 += f"\n\n### Carrier moves per quarter\n\n{table(['quarter', *PHENOTYPES], per_quarter)}\n"
# Do carriers stay carriers? Of patients with a phenotype found, how often is the same organism found again with it?
by_patient: dict[str, list[IsolateRecord]] = {}
for r in records:
    by_patient.setdefault(r.patient_id, []).append(r)
for items in by_patient.values():
    items.sort(key=lambda r: r.sample_date)
again = []
for p in PHENOTYPES:
    later = still = 0
    for items in by_patient.values():
        first_find = next((r for r in items if p in r.phenotypes), None)
        if first_find is None:
            continue
        nxt = next(
            (
                r
                for r in items
                if r.sample_date > first_find.sample_date
                and r.organism == first_find.organism
                and days_between(first_find.sample_date, r.sample_date) <= 90
            ),
            None,
        )
        if nxt is None:
            continue
        later += 1
        if p in nxt.phenotypes:
            still += 1
    flagged = [r for r in records if p in r.phenotypes]
    same_organisms = {r.organism for r in flagged}
    again.append([p, later, pct(still, later), pct(len(flagged), sum(1 for r in records if r.organism in same_organisms))])
s5 += (
    "\n### Does a carrier's next isolate of the same organism (within 90 days) carry the phenotype again?\n\n"
    + table(
        ["phenotype", "patients with a later isolate of the same organism", "carried again", "share among all isolates of those organisms"],
        again,
    )
    + "\n"
)

OUT.mkdir(parents=True, exist_ok=True)
for name, text in (("1-weekly.md", s1), ("2-cpe-vre.md", s2), ("3-resistance.md", s3), ("4-profiles.md", s4), ("5-carriers.md", s5)):
    (OUT / name).write_text(text)
print(f"wrote {OUT}: {len(records)} isolates, {len(cultures)} cultures, {len({c.culture_id for c in cultures})} culture ids")
