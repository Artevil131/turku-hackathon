#!/usr/bin/env python3
"""Re-measure the planted events listed in benchmarks/planted-events/README.md.

Reads the CSVs in data/synthetic_microbiology_dataset/ and prints, per
event, the counts the README quotes. All isolates, no first-isolate rule.

Run from the repository root:

    python3 scripts/planted_events_check.py
"""
import collections
import csv
import datetime as dt
from pathlib import Path

D = Path("data/synthetic_microbiology_dataset")


def week(date_str):
    y, w, _ = dt.date.fromisoformat(date_str).isocalendar()
    return (y, w)


def main():
    cultures = {r["culture_id"]: r for r in csv.DictReader(open(D / "cultures.csv"))}
    isolates = list(csv.DictReader(open(D / "isolates.csv")))
    susceptibility = list(csv.DictReader(open(D / "susceptibility.csv")))

    # E1: ESBL E. coli per ISO week in URO
    uro = collections.Counter()
    for i in isolates:
        c = cultures[i["culture_id"]]
        if c["ward_code"] == "URO" and i["organism"] == "Escherichia coli" and i["esbl"] == "1":
            uro[week(c["sample_date"])] += 1
    print("E1  URO ESBL E. coli per ISO week, 2025 w20-w30:",
          [uro[(2025, w)] for w in range(20, 31)])
    print("    weekly count -> number of weeks:", sorted(collections.Counter(uro.values()).items()))

    # E2: MRSA per month in ICU
    mrsa, aureus = collections.Counter(), collections.Counter()
    for i in isolates:
        c = cultures[i["culture_id"]]
        if c["ward_code"] == "ICU" and i["organism"] == "Staphylococcus aureus":
            month = c["sample_date"][:7]
            aureus[month] += 1
            if i["mrsa"] == "1":
                mrsa[month] += 1
    print("E2  ICU MRSA / all S. aureus per month, 2025-11 to 2026-06:",
          [(m, mrsa[m], aureus[m]) for m in sorted(aureus) if "2025-11" <= m <= "2026-06"])
    print("    highest MRSA count in any other month:",
          max(v for m, v in mrsa.items() if m != "2026-03"))

    # E3: empty unit-weeks
    unit_week = collections.Counter((c["ward_code"], week(c["sample_date"])) for c in cultures.values())
    units = sorted({c["ward_code"] for c in cultures.values()})
    weeks = sorted({week(c["sample_date"]) for c in cultures.values()})
    print("E3  unit-weeks with zero cultures:",
          [(u, w) for u in units for w in weeks if unit_week[(u, w)] == 0])
    print("    PHC-S cultures per week, 2025 w45-w52:", [unit_week[("PHC-S", (2025, w))] for w in range(45, 53)])

    # E4: %R by calendar year
    tmp = collections.defaultdict(lambda: [0, 0])
    tzp = collections.defaultdict(lambda: [0, 0])
    for s in susceptibility:
        c = cultures[s["culture_id"]]
        year = c["sample_date"][:4]
        if s["organism"] == "Escherichia coli" and c["specimen"] == "urine" and s["antibiotic_code"] == "TMP":
            tmp[year][s["result"] == "R"] += 1
        if s["organism"] == "Pseudomonas aeruginosa" and s["antibiotic_code"] == "TZP":
            tzp[year][s["result"] == "R"] += 1
    pct = lambda d: {y: f"{100 * v[1] / sum(v):.1f}% (n={sum(v)})" for y, v in sorted(d.items())}
    print("E4  urinary E. coli TMP %R by year:", pct(tmp))
    print("    Pseudomonas TZP %R by year:   ", pct(tzp))


if __name__ == "__main__":
    main()
