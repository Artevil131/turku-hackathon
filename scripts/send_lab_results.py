"""Send lab results to the AEI server as a laboratory system would (D-035), for the live demo.

Takes the cultures sampled in a date range from the dataset, turns them into HL7 v2.5.1 ORU^R01 messages, one
FHIR R4 Bundle per day, or one flat export per day (`aei.messages`), and POSTs them to /api/ingest, day by day.
Start the server with only the earlier data loaded, e.g.

    AEI_LOAD_UNTIL=2025-06-01 pnpm dev:api
    uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-14 --format hl7 --pause 2

and watch the alerts for the Urology outbreak arrive. `--out DIR` writes the messages to files instead of
sending them.

A second hospital (D-051), DEMO ONLY: with `--site <id>` naming a site of the server's sites file other than the
home site, the script sends the same synthetic cultures relabelled as that hospital's, with its `--token`:
culture (and so isolate) ids are prefixed `<site>-`, and so are patient ids, except a seeded fraction
(`--shared-patients`) that keep their ids and so appear at both hospitals, which makes moves and carrier trails
between hospitals. This is a relabelling of the organisers' synthetic data, not data from that hospital.

    AEI_LOAD_UNTIL=2025-06-01 AEI_SITES=deploy/container/config/sites.example.json pnpm dev:api
    uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-05 --format hl7 \\
        --site sata --token <the site's token> --shared-patients 0.2
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import random
import time
import urllib.error
import urllib.request
from itertools import groupby
from pathlib import Path

from aei.messages import LabReport, lab_reports, to_csv, to_fhir, to_hl7

CONTENT_TYPES = {"hl7": "x-application/hl7-v2+er7", "fhir": "application/fhir+json", "csv": "text/csv"}
HOME_SITE = "tyks"


def post(url: str, body: str, content_type: str, token: str | None = None) -> dict:
    headers = {"content-type": content_type, **({"authorization": f"Bearer {token}"} if token else {})}
    req = urllib.request.Request(url, data=body.encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        return {"status": e.code, **json.load(e)}


def relabel(reports: list[LabReport], site: str, shared: float, seed: int) -> list[LabReport]:
    """The reports as another hospital's (demo only): ids prefixed, a seeded fraction of patients kept as they are."""

    def keeps_id(patient_id: str) -> bool:
        return random.Random(f"{seed}:{patient_id}").random() < shared

    return [
        dataclasses.replace(
            r,
            culture_id=f"{site}-{r.culture_id}",
            patient_id=r.patient_id if keeps_id(r.patient_id) else f"{site}-{r.patient_id}",
        )
        for r in reports
    ]


def main() -> None:
    p = argparse.ArgumentParser(
        description=__doc__.splitlines()[0],
        epilog="--site with a non-home site sends a DEMO RELABELLING of the synthetic dataset, not real data from that hospital.",
    )
    p.add_argument("--from", dest="start", required=True)
    p.add_argument("--to", dest="end", required=True)
    p.add_argument("--format", choices=sorted(CONTENT_TYPES), default="hl7")
    p.add_argument("--url", default="http://localhost:8787/api/ingest")
    p.add_argument("--data", default="data/synthetic_microbiology_dataset")
    p.add_argument("--pause", type=float, default=0.0, help="seconds to wait between days")
    p.add_argument("--out", help="write the messages here instead of sending them")
    p.add_argument(
        "--site",
        default=HOME_SITE,
        help=f"the sending site's id (default {HOME_SITE}, the dataset's hospital). Another site: DEMO ONLY, the "
        "synthetic cultures relabelled as that hospital's (culture and patient ids prefixed '<site>-')",
    )
    p.add_argument("--token", help="the site's token from the sites file, sent as Authorization: Bearer")
    p.add_argument(
        "--shared-patients",
        type=float,
        default=0.0,
        help="with --site: the fraction of patients (seeded, so the same each run) that keep their ids and so appear "
        "at both hospitals, making moves and carrier trails between them (default 0)",
    )
    p.add_argument("--seed", type=int, default=0, help="seed for --shared-patients (default 0)")
    a = p.parse_args()
    if not 0 <= a.shared_patients <= 1:
        p.error("--shared-patients must be between 0 and 1")

    reports = lab_reports(a.data, a.start, a.end)
    if a.site != HOME_SITE:
        reports = relabel(reports, a.site, a.shared_patients, a.seed)
        print(f"demo: the synthetic cultures relabelled as site {a.site}; {a.shared_patients:.0%} of patients shared")
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
        result = post(a.url, body, CONTENT_TYPES[a.format], a.token)
        if result.get("status") == 401:
            raise SystemExit(f"{day}: refused (401): {result.get('error')}; check --site and --token")
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
