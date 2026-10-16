"""Dataset -> lab messages (aei.messages) -> @aei/ingest gives back the dataset's own rows (D-035).

Two weeks of cultures, including the Urology outbreak's start, sent as HL7 v2 ORU^R01, as a FHIR Bundle and as a
flat export; the ingest must return the same cultures, isolates and S/R results.
"""

from __future__ import annotations

import csv
import json
import subprocess
from pathlib import Path

import pytest

from aei.messages import lab_reports, to_csv, to_fhir, to_hl7

DATA = Path("data/synthetic_microbiology_dataset")
START, END = "2025-06-01", "2025-06-14"
pytestmark = pytest.mark.skipif(not DATA.exists(), reason=f"dataset not found at {DATA}")


@pytest.fixture(scope="module")
def parsed(tmp_path_factory) -> dict:
    reports = lab_reports(DATA, START, END)
    d = tmp_path_factory.mktemp("lab")
    (d / "batch.hl7").write_text("\n\n".join(to_hl7(r) for r in reports))
    (d / "bundle.json").write_text(json.dumps(to_fhir(reports)))
    (d / "export.csv").write_text(to_csv(reports))
    out = subprocess.run(
        ["node", "libs/utils/py/tests/ingest_dump.ts", str(d / "batch.hl7"), str(d / "bundle.json"), str(d / "export.csv")],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


@pytest.fixture(scope="module")
def expected() -> dict:
    def rows(name):
        with (DATA / name).open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    cultures = [c for c in rows("cultures.csv") if START <= c["sample_date"] <= END]
    ids = {c["culture_id"] for c in cultures}
    isolates = [i for i in rows("isolates.csv") if i["culture_id"] in ids]
    iso_ids = {i["isolate_id"] for i in isolates}
    susc = [s for s in rows("susceptibility.csv") if s["isolate_id"] in iso_ids]
    return {
        "cultures": {
            c["culture_id"]: (c["patient_id"], int(c["age_years"]), c["sample_date"], int(c["iso_year"]), int(c["iso_week"]), c["ward_code"],
                              c["ward_type"], c["admission_date"] or None, c["specimen"], c["result"], int(c["n_isolates"]))
            for c in cultures
        },
        "isolates": {i["isolate_id"]: (i["organism"], tuple(p for p in ("esbl", "mrsa", "vre", "cpe") if i[p] == "1")) for i in isolates},
        "results": {(s["isolate_id"], s["antibiotic_code"]): s["result"] for s in susc},
    }


def got(result: dict) -> dict:
    return {
        "cultures": {
            c["cultureId"]: (c["patientId"], c["ageYears"], c["sampleDate"], c["isoYear"], c["isoWeek"], c["ward"], c["wardType"],
                             c["admissionDate"], c["specimen"], c["result"], c["nIsolates"])
            for c in result["cultures"]
        },
        "isolates": {i["isolateId"]: (i["organism"], tuple(i["phenotypes"])) for i in result["isolates"]},
        "results": {(s["isolateId"], s["antibiotic"]): s["result"] for s in result["susceptibility"]},
    }


@pytest.mark.parametrize("fmt", ["hl7", "fhir"])
def test_roundtrip(parsed, expected, fmt):
    r = parsed[fmt]
    assert r["warnings"] == []
    g = got(r)
    assert len(expected["cultures"]) > 300
    assert g["cultures"] == expected["cultures"]
    assert g["isolates"] == expected["isolates"]
    assert g["results"] == expected["results"]


def test_roundtrip_flat_export(parsed, expected):
    # The flat export has no column for mixed growth, so those cultures come back negative.
    r = parsed["csv"]
    assert r["warnings"] == []
    g = got(r)
    mixed = {k for k, v in expected["cultures"].items() if v[9] == "mixed_growth"}
    for k in mixed:
        assert g["cultures"][k][9] == "negative"
    assert {k: v for k, v in g["cultures"].items() if k not in mixed} == {k: v for k, v in expected["cultures"].items() if k not in mixed}
    assert g["isolates"] == expected["isolates"]
    assert g["results"] == expected["results"]
