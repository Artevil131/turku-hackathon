"""Code lists of the synthetic dataset (mirrors @aei/domain): units, antibiotics, phenotypes."""

from __future__ import annotations

# Units in the order of @aei/domain WARDS, with their type ("in": inpatient).
WARD_TYPE: dict[str, str] = {
    "ED": "out",
    "MED-A": "in",
    "MED-B": "in",
    "SURG": "in",
    "URO": "in",
    "ICU": "in",
    "GER": "in",
    "PHC-N": "out",
    "PHC-S": "out",
}
UNITS: list[str] = list(WARD_TYPE)

# Antibiotics in the order of @aei/domain ANTIBIOTICS, with the specimen they are reported for.
REPORTED_FOR: dict[str, str] = {
    "AMP": "all",
    "MEC": "urine",
    "TZP": "all",
    "FOX": "all",
    "CXM": "all",
    "CRO": "all",
    "CAZ": "all",
    "MEM": "all",
    "CIP": "all",
    "TMP": "urine",
    "NIT": "urine",
    "VAN": "all",
    "CLI": "all",
}
ANTIBIOTICS: list[str] = list(REPORTED_FOR)
PHENOTYPES: list[str] = ["esbl", "mrsa", "vre", "cpe"]
SPECIMENS: list[str] = ["urine", "blood", "wound"]
