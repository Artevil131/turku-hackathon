"""Fetch the national susceptibility reference from THL's Finres cube (D-048).

Source: THL Finres cube, CC BY 4.0 (c) THL and the FiRe laboratory network; the logic is in `aei.finres`. Writes
the latest year that has figures, per genus x antibiotic x specimen (tests, resistant, %R, 95 % interval, null
where the cube has no figure), the file /api/national serves:

    data/external/thl/finres.json

Run from the repository root (a few seconds, a few tens of kB):

    uv run python scripts/fetch_finres.py [--out data/external/thl]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from aei.finres import finres_view


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default="data/external/thl")
    args = parser.parse_args()
    view = finres_view(fetched=dt.date.today().isoformat())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "finres.json"
    path.write_text(json.dumps(view, ensure_ascii=False))
    with_pct = sum(c["pctR"] is not None for c in view["cells"])
    print(f"wrote {path}: Finland {view['year']}, {len(view['cells'])} cells ({with_pct} with %R)")


if __name__ == "__main__":
    main()
