"""Fetch monthly MRSA, ESBL, VRE and CPE case counts by wellbeing services county from THL (D-025).

Source: THL communicable disease register, cases cube, CC BY 4.0 (c) THL; the logic is in `aei.thl`. Writes one
long CSV:

    data/external/thl/ttr_monthly.csv
    columns: group_sid, group, region_sid, region, cases, incidence_per_100k, month (YYYY-MM)

Run from the repository root (a few seconds, about 1 MB):

    uv run python scripts/fetch_thl_ttr.py [--out data/external/thl]
"""

from __future__ import annotations

import argparse
from pathlib import Path

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


if __name__ == "__main__":
    main()
