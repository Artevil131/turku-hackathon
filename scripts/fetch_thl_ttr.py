"""Fetch monthly MRSA, ESBL, VRE and CPE case counts by wellbeing services county from THL (D-025).

Source: THL communicable disease register, cases cube, CC BY 4.0 (c) THL; the logic is in `aei.thl`. Writes one
long CSV, and the county series with their regional signals (experiments/0008) and next-month
phenotype-total forecasts (experiment 0020 R1, D-045; VRE omitted) that /api/regional serves (D-037):

    data/external/thl/ttr_monthly.csv
    columns: group_sid, group, region_sid, region, cases, incidence_per_100k, month (YYYY-MM)
    data/external/thl/regional.json

Run from the repository root (a few seconds, about 1 MB):

    uv run python scripts/fetch_thl_ttr.py [--out data/external/thl]

Offline rebuild (keeps the original fetch date from the adjacent regional.json):

    uv run python scripts/fetch_thl_ttr.py --from-csv [PATH]

If the adjacent regional.json is missing, supply --fetched YYYY-MM-DD explicitly.
Offline mode never calls THL and never rewrites the input CSV.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import warnings
from pathlib import Path

import pandas as pd

from aei.regional import regional_view
from aei.thl import fetch_ttr_monthly


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="data/external/thl")
    parser.add_argument("--from-csv", nargs="?", const="", metavar="PATH", help="Rebuild offline; defaults to OUT/ttr_monthly.csv. Never fetches or overwrites the CSV.")
    parser.add_argument("--fetched", help="Original THL fetch date (YYYY-MM-DD); offline defaults to the existing regional.json date.")
    args = parser.parse_args()
    out = Path(args.out)
    fetched = args.fetched
    if args.from_csv is not None:
        csv = Path(args.from_csv) if args.from_csv else out / "ttr_monthly.csv"
        previous = csv.with_name("regional.json")
        if fetched is None and previous.exists():
            fetched = json.loads(previous.read_text())["fetched"]
        if fetched is None:
            parser.error("--from-csv needs --fetched with the original fetch date when regional.json is missing")
        data = pd.read_csv(csv)
    else:
        data = fetch_ttr_monthly()
        fetched = fetched or dt.date.today().isoformat()
        out.mkdir(parents=True, exist_ok=True)
        path = out / "ttr_monthly.csv"
        data.to_csv(path, index=False)
        print(f"wrote {path}: {len(data)} rows, {data['month'].min()} to {data['month'].max()}, {data['region'].nunique()} regions")
    warnings.filterwarnings("ignore")
    view = regional_view(data, fetched=fetched)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "regional.json"
    path.write_text(json.dumps(view, ensure_ascii=False))
    print(f"wrote {path}: {len(view['series'])} series, {view['months'][0]} to {view['months'][-1]}, "
          f"{len(view['signals'])} signals, {len(view['forecasts'])} forecasts")


if __name__ == "__main__":
    main()
