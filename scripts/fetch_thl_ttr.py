"""Fetch monthly MRSA, ESBL, VRE and CPE case counts by wellbeing services county from THL.

Source: THL communicable disease register, cases cube
(https://sampo.thl.fi/pivot/prod/fi/ttr/cases/fact_ttr_cases), JSON-stat API,
licence CC BY 4.0 (© THL). Writes one long CSV:

    data/external/thl/ttr_monthly.csv
    columns: group_sid, group, region_sid, region, month (YYYY-MM), cases, incidence_per_100k

Run from the repository root (a few seconds, about 1 MB):

    uv run python scripts/fetch_thl_ttr.py [--out data/external/thl]
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from pathlib import Path

import pandas as pd

BASE = "https://sampo.thl.fi/pivot/prod/fi/ttr/cases/fact_ttr_cases"
# Report groups (nidrreportgroup sids, from fact_ttr_cases.dimensions.json).
GROUPS = {
    878155: "MRSA carriage",
    878105: "MRSA blood/CSF",
    877792: "ESBL carriage, E. coli",
    878134: "ESBL carriage, K. pneumoniae",
    878175: "ESBL blood/CSF, E. coli",
    877764: "ESBL blood/CSF, K. pneumoniae",
    878111: "VRE carriage",
    877916: "VRE blood/CSF",
    878012: "CPE carriage, K. pneumoniae",
    877958: "CPE carriage, E. coli",
    878164: "CPE carriage, E. cloacae",
}
MONTH_LEVEL = 1209312  # any month: "L" asks for every member of its level
REGION_LEVEL = 878211  # Varsinais-Suomi: its level is every county
MEASURES = {877837: "cases", 931297: "incidence_per_100k"}
MONTHS_FI = {
    "tammikuu": 1, "helmikuu": 2, "maaliskuu": 3, "huhtikuu": 4, "toukokuu": 5, "kesäkuu": 6,
    "heinäkuu": 7, "elokuu": 8, "syyskuu": 9, "lokakuu": 10, "marraskuu": 11, "joulukuu": 12,
}


def fetch(group: int, measure: int) -> pd.DataFrame:
    url = (
        f"{BASE}.json?row=yearmonth-{MONTH_LEVEL}L&column=wscmunicipality2022-{REGION_LEVEL}L"
        f"&filter=nidrreportgroup-{group}&filter=measure-{measure}"
    )
    with urllib.request.urlopen(url, timeout=60) as res:
        ds = json.load(res)["dataset"]
    ids, sizes = ds["dimension"]["id"], ds["dimension"]["size"]
    cats = [ds["dimension"][d]["category"] for d in ids]
    order = [sorted(c["index"], key=lambda k: c["index"][k]) for c in cats]
    rows = []
    for flat, value in ds["value"].items():
        i, j = divmod(int(flat), sizes[1])
        month_sid, region_sid = order[0][i], order[1][j]
        rows.append((month_sid, cats[0]["label"][month_sid], region_sid, cats[1]["label"][region_sid], value))
    return pd.DataFrame(rows, columns=["month_sid", "month_label", "region_sid", "region", MEASURES[measure]])


def to_month(label: str) -> str | None:
    m = re.match(r"(\w+) (\d{4})$", label.strip())
    if not m or m.group(1) not in MONTHS_FI:
        return None
    return f"{m.group(2)}-{MONTHS_FI[m.group(1)]:02d}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="data/external/thl")
    out = Path(parser.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    frames = []
    for sid, name in GROUPS.items():
        cases, inc = (fetch(sid, m) for m in MEASURES)
        df = cases.merge(inc, on=["month_sid", "month_label", "region_sid", "region"], how="outer")
        df.insert(0, "group", name)
        df.insert(0, "group_sid", sid)
        frames.append(df)
    data = pd.concat(frames, ignore_index=True)
    data["month"] = data["month_label"].map(to_month)
    data = data.dropna(subset=["month"]).drop(columns=["month_sid", "month_label"])
    for col in MEASURES.values():
        data[col] = pd.to_numeric(data[col], errors="coerce")
    data = data.sort_values(["group_sid", "region", "month"])
    path = out / "ttr_monthly.csv"
    data.to_csv(path, index=False)
    print(f"wrote {path}: {len(data)} rows, {data['month'].min()} to {data['month'].max()}, {data['region'].nunique()} regions")


if __name__ == "__main__":
    main()
