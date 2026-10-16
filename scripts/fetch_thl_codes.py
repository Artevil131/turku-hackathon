"""Fetch THL's microbe and antimicrobial code lists from the Kanta code server and write the codes the dataset uses
to libs/utils/ingest/src/thl-codes.json, which @aei/ingest and aei.messages read (D-036).

    uv run python scripts/fetch_thl_codes.py
"""

from __future__ import annotations

import json
from pathlib import Path

from aei.kanta import thl_code_map

OUT = Path(__file__).resolve().parents[1] / "libs/utils/ingest/src/thl-codes.json"


def main() -> None:
    mapping = thl_code_map()
    OUT.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(mapping['microbes']['codes'])} microbes, {len(mapping['antimicrobials']['codes'])} antimicrobials -> {OUT}")


if __name__ == "__main__":
    main()
