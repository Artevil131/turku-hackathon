"""Load the organiser's CSV files into pandas (mirrors @aei/dataset).

    data = load_dataset("data/synthetic_microbiology_dataset")
    iso = join_isolates(data)   # one row per isolate, culture and patient joined, one column per antibiotic (S/R/NaN)
"""

from __future__ import annotations

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
