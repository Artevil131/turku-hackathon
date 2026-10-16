"""Lab results from the dataset as a laboratory system would send them (D-035): HL7 v2.5.1 ORU^R01, a FHIR R4
Bundle, or a flat isolate export. Used by scripts/send_lab_results.py for the live demo and by the round-trip
test against @aei/ingest.

    reports = lab_reports("data/synthetic_microbiology_dataset", "2025-06-01", "2025-06-07")
    to_hl7(reports[0]);  to_fhir(reports);  to_csv(reports)

Codes follow what the ingest maps by default: organisms and antibiotics in THL's national codes with their Finnish
names (libs/utils/ingest/src/thl-codes.json, D-036), specimens by HL7 table 0487, wards by unit code.
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field
from pathlib import Path

from aei.domain import ANTIBIOTICS, PHENOTYPES

THL_CODES = json.loads((Path(__file__).resolve().parents[2] / "ingest/src/thl-codes.json").read_text())
THL_MICROBES = THL_CODES["microbes"]["system"]
THL_ANTIMICROBIALS = THL_CODES["antimicrobials"]["system"]
# The dataset's organisms and antibiotics to THL (code, name); the first THL code listed for an antibiotic wins.
ORGANISM_CODES: dict[str, tuple[str, str]] = {c["aei"]: (k, c["name"]) for k, c in THL_CODES["microbes"]["codes"].items()}
ANTIBIOTIC_CODES: dict[str, tuple[str, str]] = {}
for _k, _c in THL_CODES["antimicrobials"]["codes"].items():
    ANTIBIOTIC_CODES.setdefault(_c["aei"], (_k, _c["name"]))
SPECIMEN_0487 = {"urine": ("UR", "Urine"), "blood": ("BLDC", "Blood culture"), "wound": ("WND", "Wound")}
SPECIMEN_SNOMED = {"urine": ("122575003", "Urine specimen"), "blood": ("119297000", "Blood specimen"), "wound": ("258530009", "Wound swab")}


@dataclass
class Isolate:
    number: int
    organism: str
    phenotypes: list[str]
    results: dict[str, str] = field(default_factory=dict)


@dataclass
class LabReport:
    """One culture as the lab reports it."""

    culture_id: str
    patient_id: str
    sex: str
    birth_year: int
    sample_date: str
    ward: str
    ward_type: str
    admission_date: str | None
    specimen: str
    result: str  # positive, negative or mixed_growth
    isolates: list[Isolate]


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def lab_reports(directory: str | Path, start: str, end: str) -> list[LabReport]:
    """Every culture sampled from `start` to `end` (inclusive), in sample order."""
    d = Path(directory)
    patients = {r["patient_id"]: r for r in _rows(d / "patients.csv")}
    cultures = [r for r in _rows(d / "cultures.csv") if start <= r["sample_date"] <= end]
    wanted = {r["culture_id"] for r in cultures}
    isolates: dict[str, list[Isolate]] = {}
    by_id: dict[str, Isolate] = {}
    for r in _rows(d / "isolates.csv"):
        if r["culture_id"] not in wanted:
            continue
        iso = Isolate(int(r["isolate_no"]), r["organism"], [p for p in PHENOTYPES if r[p] == "1"])
        isolates.setdefault(r["culture_id"], []).append(iso)
        by_id[r["isolate_id"]] = iso
    for r in _rows(d / "susceptibility.csv"):
        if r["isolate_id"] in by_id:
            by_id[r["isolate_id"]].results[r["antibiotic_code"]] = r["result"]
    out = []
    for c in sorted(cultures, key=lambda r: (r["sample_date"], r["culture_id"])):
        p = patients[c["patient_id"]]
        out.append(
            LabReport(
                culture_id=c["culture_id"],
                patient_id=c["patient_id"],
                sex=p["sex"],
                birth_year=int(p["birth_year"]),
                sample_date=c["sample_date"],
                ward=c["ward_code"],
                ward_type=c["ward_type"],
                admission_date=c["admission_date"] or None,
                specimen=c["specimen"],
                result=c["result"],
                isolates=sorted(isolates.get(c["culture_id"], []), key=lambda i: i.number),
            )
        )
    return out


def _hl7_date(date: str | None, time: str = "") -> str:
    return (date or "").replace("-", "") + time


def to_hl7(r: LabReport, message_id: str | None = None) -> str:
    """ORU^R01: a culture OBR, one organism OBX per isolate (OBX-4 = isolate number), phenotype OBXs, and a child
    OBR per isolate with its susceptibilities (OBR-26 the organism's sub-id, OBR-29 the parent order)."""
    spec_code, spec_text = SPECIMEN_0487[r.specimen]
    collected = _hl7_date(r.sample_date, "0800")
    pv1 = ["PV1", "1", "I" if r.ward_type == "in" else "O", f"{r.ward}^^^TYKS"] + [""] * 41
    pv1[44] = _hl7_date(r.admission_date)
    obr = ["OBR", "1", f"PL-{r.culture_id}", r.culture_id, "BAKTVI^Bakteeriviljely^L", "", "", collected] + [""] * 18
    obr[22], obr[24], obr[25] = collected, "MB", "F"
    segments = [
        f"MSH|^~\\&|MYPLUS|TYKSLAB|AEI|VARHA|{collected}00||ORU^R01^ORU_R01|{message_id or r.culture_id}|P|2.5.1",
        f"PID|1||{r.patient_id}^^^VARHA^PI||||{r.birth_year}0101|{r.sex}",
        "|".join(pv1),
        "|".join(obr),
        f"SPM|1|||{spec_code}^{spec_text}^HL70487" + "|" * 13 + collected,
    ]
    if not r.isolates:
        value = "MIX^Sekakasvu^L" if r.result == "mixed_growth" else "NEG^Ei kasvua^L"
        segments.append(f"OBX|1|CWE|BAKTVI^Bakteeriviljely^L|1|{value}||||||F")
        return "\r".join(segments)
    n = 0
    for iso in r.isolates:
        n += 1
        code, name = ORGANISM_CODES[iso.organism]
        segments.append(f"OBX|{n}|CWE|BAKTVI^Bakteeriviljely^L|{iso.number}|{code}^{name}^{THL_MICROBES}||||||F")
        for ph in iso.phenotypes:
            n += 1
            segments.append(f"OBX|{n}|CWE|{ph.upper()}^{ph.upper()}^L|{iso.number}|POS^Positive^L||||||F")
    for iso in r.isolates:
        if not iso.results:
            continue
        child = ["OBR", str(iso.number + 1), f"PL-{r.culture_id}", f"{r.culture_id}-{iso.number}", "AST^Herkkyys^L", "", "", collected] + [""] * 22
        child[11], child[22], child[24], child[25] = "G", collected, "MB", "F"
        child[26] = f"BAKTVI&Bakteeriviljely&L^{iso.number}^{iso.organism}"
        child[29] = f"PL-{r.culture_id}&{r.culture_id}"
        segments.append("|".join(child))
        for k, (ab, sr) in enumerate(iso.results.items(), start=1):
            code, name = ANTIBIOTIC_CODES[ab]
            segments.append(f"OBX|{k}|ST|{code}^{name}^{THL_ANTIMICROBIALS}|{iso.number}||||{sr}|||F")
    return "\r".join(segments)


def to_fhir(reports: list[LabReport]) -> dict:
    """A collection Bundle shaped like HL7 Europe Laboratory Report 2.1.0: DiagnosticReport, Patient, Encounter,
    Specimen, an organism Observation per isolate with a susceptibility panel of one Observation per antibiotic."""
    entries: list[dict] = []
    seen_patients: set[str] = set()

    def add(resource: dict) -> str:
        url = f"urn:uuid:{resource['resourceType'].lower()}-{resource['id']}"
        entries.append({"fullUrl": url, "resource": resource})
        return url

    for r in reports:
        pat = f"urn:uuid:patient-{r.patient_id}"
        if r.patient_id not in seen_patients:
            seen_patients.add(r.patient_id)
            add({
                "resourceType": "Patient",
                "id": r.patient_id,
                "identifier": [{"system": "urn:oid:1.2.246.21", "value": r.patient_id}],
                "gender": "female" if r.sex == "F" else "male",
                "birthDate": str(r.birth_year),
            })
        enc = add({
            "resourceType": "Encounter",
            "id": r.culture_id,
            "status": "in-progress",
            "class": {"code": "IMP" if r.ward_type == "in" else "AMB"},
            **({"period": {"start": r.admission_date}} if r.admission_date else {}),
            "location": [{"location": {"identifier": {"value": r.ward}, "display": r.ward}}],
        })
        code, text = SPECIMEN_SNOMED[r.specimen]
        spec = add({
            "resourceType": "Specimen",
            "id": r.culture_id,
            "type": {"coding": [{"system": "http://snomed.info/sct", "code": code, "display": text}]},
            "collection": {"collectedDateTime": f"{r.sample_date}T08:00:00+03:00"},
        })
        results = []
        for iso in r.isolates:
            sid = f"{r.culture_id}-{iso.number}"
            susc = [
                add({
                    "resourceType": "Observation",
                    "id": f"{sid}-{ab}",
                    "status": "final",
                    "code": {"coding": [{"system": f"urn:oid:{THL_ANTIMICROBIALS}", "code": ANTIBIOTIC_CODES[ab][0], "display": ANTIBIOTIC_CODES[ab][1]}]},
                    "interpretation": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", "code": sr}]}],
                })
                for ab, sr in iso.results.items()
            ]
            panel = add({
                "resourceType": "Observation",
                "id": f"{sid}-panel",
                "status": "final",
                "code": {"coding": [{"system": "http://loinc.org", "code": "29576-6", "display": "Bacterial susceptibility panel"}]},
                "hasMember": [{"reference": u} for u in susc],
            })
            phenos = [
                add({"resourceType": "Observation", "id": f"{sid}-{ph}", "status": "final", "code": {"text": ph.upper()}, "valueBoolean": True})
                for ph in iso.phenotypes
            ]
            results.append(add({
                "resourceType": "Observation",
                "id": sid,
                "status": "final",
                "code": {"coding": [{"system": "http://loinc.org", "code": "634-6", "display": "Bacteria identified"}]},
                "valueCodeableConcept": {
                    "coding": [{"system": f"urn:oid:{THL_MICROBES}", "code": ORGANISM_CODES[iso.organism][0], "display": iso.organism}],
                    "text": iso.organism,
                },
                "hasMember": [{"reference": u} for u in [panel, *phenos]],
            }))
        if not r.isolates:
            text = "Sekakasvu" if r.result == "mixed_growth" else "Ei kasvua"
            results.append(add({"resourceType": "Observation", "id": f"{r.culture_id}-nogrowth", "status": "final", "code": {"text": "Culture"}, "valueString": text}))
        add({
            "resourceType": "DiagnosticReport",
            "id": r.culture_id,
            "identifier": [{"value": r.culture_id}],
            "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0074", "code": "MB"}]}],
            "code": {"text": "Bacterial culture"},
            "subject": {"reference": pat},
            "encounter": {"reference": enc},
            "specimen": [{"reference": spec}],
            "effectiveDateTime": f"{r.sample_date}T08:00:00+03:00",
            "result": [{"reference": u} for u in results],
        })
    return {"resourceType": "Bundle", "type": "collection", "entry": entries}


def to_csv(reports: list[LabReport]) -> str:
    """One row per isolate (a culture with none gets one row with no organism), antibiotics as WHONET columns."""
    cols = ["patient_id", "sex", "birth_year", "specimen_number", "spec_date", "ward", "admission_date", "spec_type", "organism",
            *PHENOTYPES, *ANTIBIOTICS]
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(cols)
    for r in reports:
        base = [r.patient_id, r.sex, r.birth_year, r.culture_id, r.sample_date, r.ward, r.admission_date or "", r.specimen]
        for iso in r.isolates or [None]:
            if iso is None:
                w.writerow([*base, "", *[""] * len(PHENOTYPES), *[""] * len(ANTIBIOTICS)])
            else:
                w.writerow([*base, iso.organism, *["1" if p in iso.phenotypes else "0" for p in PHENOTYPES],
                            *[iso.results.get(a, "") for a in ANTIBIOTICS]])
    return buf.getvalue()
