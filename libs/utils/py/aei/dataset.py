"""Load the organiser's CSV files (mirrors @aei/dataset).

    data = load_dataset("data/synthetic_microbiology_dataset")
    iso = join_isolates(data)   # one row per isolate, culture and patient joined, one column per antibiotic (S/R/NaN)

    records, cultures = load_records("data/synthetic_microbiology_dataset")   # plain objects, as the TypeScript gears see them
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

ANTIBIOTICS = ["AMP", "MEC", "TZP", "FOX", "CXM", "CRO", "CAZ", "MEM", "CIP", "TMP", "NIT", "VAN", "CLI"]
PHENOTYPES = ["esbl", "mrsa", "vre", "cpe"]
INPATIENT_UNITS = ["MED-A", "MED-B", "SURG", "URO", "ICU", "GER"]


def load_dataset(directory: str | Path) -> dict[str, pd.DataFrame]:
    """The four data files, with dates parsed. The directory is passed in."""
    d = Path(directory)
    cultures = pd.read_csv(d / "cultures.csv", parse_dates=["sample_date", "admission_date"])
    return {
        "patients": pd.read_csv(d / "patients.csv"),
        "cultures": cultures,
        "isolates": pd.read_csv(d / "isolates.csv"),
        "susceptibility": pd.read_csv(d / "susceptibility.csv"),
    }


def join_isolates(data: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """One row per isolate: culture, patient, phenotype flags and one S/R column per antibiotic code."""
    wide = data["susceptibility"].pivot(index="isolate_id", columns="antibiotic_code", values="result")
    wide = wide.reindex(columns=ANTIBIOTICS)
    iso = data["isolates"].merge(data["cultures"], on="culture_id", how="left", validate="many_to_one")
    iso = iso.merge(data["patients"], on="patient_id", how="left", validate="many_to_one")
    iso = iso.merge(wide, left_on="isolate_id", right_index=True, how="left")
    stay = (iso["sample_date"] - iso["admission_date"]).dt.days
    iso["hospital_onset"] = stay.ge(2).fillna(False).astype(bool)
    iso["inpatient"] = iso["ward_code"].isin(INPATIENT_UNITS)
    return iso


@dataclass(slots=True)
class Culture:
    """One row of cultures.csv (the fields the gears use), like @aei/domain Culture."""

    culture_id: str
    patient_id: str
    sample_date: str
    ward: str
    ward_type: str
    admission_date: str | None
    specimen: str
    result: str
    iso_year: int
    iso_week: int
    age_years: int


@dataclass(slots=True)
class IsolateRecord:
    """One isolate with its culture, patient and results joined, like @aei/domain IsolateRecord."""

    isolate_id: str
    culture_id: str
    patient_id: str
    sample_date: str
    admission_date: str | None
    ward: str
    specimen: str
    organism: str
    sex: str
    age_years: int
    home_area: str
    phenotypes: tuple[str, ...]
    results: dict[str, str] = field(default_factory=dict)


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_records(directory: str | Path) -> tuple[list[IsolateRecord], list[Culture]]:
    """Isolate records (isolates.csv order) and cultures (cultures.csv order), as `joinIsolates` and `loadDataset` give them."""
    d = Path(directory)
    patients = {r["patient_id"]: r for r in _rows(d / "patients.csv")}
    cultures = [
        Culture(
            culture_id=r["culture_id"],
            patient_id=r["patient_id"],
            sample_date=r["sample_date"],
            ward=r["ward_code"],
            ward_type=r["ward_type"],
            admission_date=r["admission_date"] or None,
            specimen=r["specimen"],
            result=r["result"],
            iso_year=int(r["iso_year"]),
            iso_week=int(r["iso_week"]),
            age_years=int(r["age_years"]),
        )
        for r in _rows(d / "cultures.csv")
    ]
    by_culture = {c.culture_id: c for c in cultures}
    results: dict[str, dict[str, str]] = {}
    for r in _rows(d / "susceptibility.csv"):
        results.setdefault(r["isolate_id"], {})[r["antibiotic_code"]] = r["result"]
    records = []
    for r in _rows(d / "isolates.csv"):
        c = by_culture[r["culture_id"]]
        p = patients[c.patient_id]
        records.append(
            IsolateRecord(
                isolate_id=r["isolate_id"],
                culture_id=r["culture_id"],
                patient_id=c.patient_id,
                sample_date=c.sample_date,
                admission_date=c.admission_date,
                ward=c.ward,
                specimen=c.specimen,
                organism=r["organism"],
                sex=p["sex"],
                age_years=c.age_years,
                home_area=p["home_area"],
                phenotypes=tuple(ph for ph in PHENOTYPES if r[ph] == "1"),
                results=results.get(r["isolate_id"], {}),
            )
        )
    return records, cultures
