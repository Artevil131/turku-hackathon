#!/usr/bin/env python3
"""Fetch the wellbeing services county polygons from Statistics Finland's WFS (1:4.5M, WGS84, CC BY 4.0).

Used by the regional map pages in scripts/explore (finland.html, surface.html) together with the THL series
written by scripts/fetch_thl_ttr.py (D-025, D-037). Writes:

    data/external/statfi/counties.geojson

Run from the repository root (about 100 kB):

    uv run python scripts/fetch_county_geometry.py [--out data/external/statfi]
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path

WFS = (
    "https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=2.0.0"
    "&request=GetFeature&typeName=tilastointialueet:hyvinvointialue4500k&outputFormat=json&srsName=EPSG:4326"
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="data/external/statfi")
    out = Path(parser.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(WFS, timeout=60) as res:
        geo = json.load(res)
    path = out / "counties.geojson"
    path.write_text(json.dumps(geo, ensure_ascii=False))
    print(f"wrote {path}: {len(geo['features'])} areas")


if __name__ == "__main__":
    main()
