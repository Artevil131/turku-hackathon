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


def site_of_ward(ward: str) -> str:
    """Hospital prefix of a unit code, or the home site (D-051)."""
    index = ward.find("/")
    return ward[:index] if index > 0 else "tyks"


def by_site(rows: list) -> dict:
    """Group rows by hospital, home site first when present, as @aei/domain."""
    out: dict = {"tyks": []}
    for row in rows:
        out.setdefault(site_of_ward(row.ward), []).append(row)
    if not out["tyks"]:
        del out["tyks"]
    return out


AGE_GROUPS = {"child": (0, 17), "adult": (18, 64), "older": (65, None), "veryOld": (80, None)}


def in_age_group(age_years: int, group: str) -> bool:
    lower, upper = AGE_GROUPS[group]
    return age_years >= lower and (upper is None or age_years <= upper)

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
