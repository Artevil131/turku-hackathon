"""Canonical D-058 rows, shared by online and offline verification."""

import hashlib
import json


def _fingerprint_rows(records: list[dict]) -> dict:
    """Mirror @aei/projects fingerprintRows; identifiers and codes use ASCII ordering."""
    rows = [
        (r["isolateId"], json.dumps(
            [r["isolateId"], r["sampleDate"], r["ward"], r["organism"], sorted(r["results"].items())],
            separators=(",", ":"), ensure_ascii=False,
        ))
        for r in records
    ]
    rows.sort()
    return {"rows": len(rows), "sha256": hashlib.sha256("\n".join(row for _, row in rows).encode("utf-8")).hexdigest()}
