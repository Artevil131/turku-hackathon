"""Send lab results to the AEI server as a laboratory system would (D-035), for the live demo.

Takes the cultures sampled in a date range from the dataset, turns them into HL7 v2.5.1 ORU^R01 messages, one
FHIR R4 Bundle per day, or one flat export per day (`aei.messages`), and POSTs them to /api/ingest, day by day.
Start the server with only the earlier data loaded, e.g.

    AEI_LOAD_UNTIL=2025-06-01 pnpm dev:api
    uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-14 --format hl7 --pause 2

and watch the alerts for the Urology outbreak arrive. `--out DIR` writes the messages to files instead of
sending them.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from itertools import groupby
from pathlib import Path

from aei.messages import lab_reports, to_csv, to_fhir, to_hl7

CONTENT_TYPES = {"hl7": "x-application/hl7-v2+er7", "fhir": "application/fhir+json", "csv": "text/csv"}


def post(url: str, body: str, content_type: str) -> dict:
    req = urllib.request.Request(url, data=body.encode("utf-8"), headers={"content-type": content_type}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        return {"status": e.code, **json.load(e)}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--from", dest="start", required=True)
    p.add_argument("--to", dest="end", required=True)
    p.add_argument("--format", choices=sorted(CONTENT_TYPES), default="hl7")
    p.add_argument("--url", default="http://localhost:8787/api/ingest")
    p.add_argument("--data", default="data/synthetic_microbiology_dataset")
    p.add_argument("--pause", type=float, default=0.0, help="seconds to wait between days")
    p.add_argument("--out", help="write the messages here instead of sending them")
    a = p.parse_args()

    reports = lab_reports(a.data, a.start, a.end)
    for day, group in groupby(reports, key=lambda r: r.sample_date):
        day_reports = list(group)
        if a.format == "hl7":
            body = "\n\n".join(to_hl7(r) for r in day_reports)
        elif a.format == "fhir":
            body = json.dumps(to_fhir(day_reports))
        else:
            body = to_csv(day_reports)
        if a.out:
            out = Path(a.out)
            out.mkdir(parents=True, exist_ok=True)
            path = out / f"{day}.{ {'hl7': 'hl7', 'fhir': 'json', 'csv': 'csv'}[a.format] }"
            path.write_text(body)
            print(f"{day}: {len(day_reports)} cultures -> {path}")
            continue
        result = post(a.url, body, CONTENT_TYPES[a.format])
        alerts = result.get("newAlerts", [])
        checks = result.get("quality", [])
        print(f"{day}: sent {len(day_reports)} cultures; accepted {result.get('accepted', 0)}, clock {result.get('asOf')}, "
              f"{f'{len(checks)} data-check finding(s)' if checks else 'data checks passed'}, "
              f"{len(alerts)} new alert(s){': ' + ', '.join(alerts) if alerts else ''}"
              f"{'; warnings: ' + '; '.join(result['warnings'][:3]) if result.get('warnings') else ''}")
        if a.pause:
            time.sleep(a.pause)


if __name__ == "__main__":
    main()
