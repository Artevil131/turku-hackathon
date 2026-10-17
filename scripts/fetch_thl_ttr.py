"""Fetch monthly MRSA, ESBL, VRE and CPE case counts by wellbeing services county from THL (D-025).

Source: THL communicable disease register, cases cube, CC BY 4.0 (c) THL; the logic is in `aei.thl`. Writes one
long CSV, and the county series with their regional signals (experiments/0008) and next-month
phenotype-total forecasts (experiment 0020 R1, D-045; VRE omitted) that /api/regional serves (D-037):

    data/external/thl/ttr_monthly.csv
    columns: group_sid, group, region_sid, region, cases, incidence_per_100k, month (YYYY-MM)
    data/external/thl/regional.json

Run from the repository root (a few seconds, about 1 MB):

    uv run python scripts/fetch_thl_ttr.py [--out data/external/thl]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import warnings
from pathlib import Path

from aei.regional import regional_view
from aei.thl import fetch_ttr_monthly


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="data/external/thl")
    out = Path(parser.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    data = fetch_ttr_monthly()
    path = out / "ttr_monthly.csv"
    data.to_csv(path, index=False)
    print(f"wrote {path}: {len(data)} rows, {data['month'].min()} to {data['month'].max()}, {data['region'].nunique()} regions")
    warnings.filterwarnings("ignore")
    view = regional_view(data, fetched=dt.date.today().isoformat())
    path = out / "regional.json"
    path.write_text(json.dumps(view, ensure_ascii=False))
    print(f"wrote {path}: {len(view['series'])} series, {view['months'][0]} to {view['months'][-1]}, "
          f"{len(view['signals'])} signals, {len(view['forecasts'])} forecasts")


if __name__ == "__main__":
    main()
