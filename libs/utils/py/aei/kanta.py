"""THL's national microbiology code lists from the Kanta code server (koodistopalvelu.kanta.fi), mapped to the
dataset's vocabulary (D-036). Finnish labs report organisms and antibiotics in these codes, so the ingest reads them
without a site map. The code server's REST API needs no login; its spec is at
https://koodistopalvelu.kanta.fi/codeserver/resources/apidocs/v8/openapi.yaml.

    mapping = thl_code_map()   # {"microbes": {...}, "antimicrobials": {...}}, written by scripts/fetch_thl_codes.py
"""

from __future__ import annotations

import datetime as dt
import json
import urllib.request

API = "https://koodistopalvelu.kanta.fi/codeserver/csapi/v8/classifications"
MICROBES = "1.2.246.537.6.241"  # THL - Mikrobinimikkeistö
ANTIMICROBIALS = "1.2.246.537.6.249"  # THL - Mikrobilääkkeet
SUSCEPTIBILITY = "1.2.246.537.6.253"  # THL - Mikrobin herkkyys (S / I / R)

# The dataset's organisms carry THL's names unchanged.
ORGANISMS = [
    "Escherichia coli",
    "Klebsiella pneumoniae",
    "Klebsiella oxytoca",
    "Proteus mirabilis",
    "Citrobacter freundii",
    "Pseudomonas aeruginosa",
    "Enterococcus faecalis",
    "Staphylococcus aureus",
    "Staphylococcus saprophyticus",
]
# The dataset's antibiotic codes by THL's Finnish names. Amoxicillin results stand for ampicillin under EUCAST.
ANTIBIOTICS = {
    "Ampisilliini": "AMP",
    "Amoksisilliini": "AMP",
    "Mesillinaami": "MEC",
    "Piperasilliini-tatsobaktaami": "TZP",
    "Kefoksitiini": "FOX",
    "Kefuroksiimi": "CXM",
    "Keftriaksoni": "CRO",
    "Keftatsidiimi": "CAZ",
    "Meropeneemi": "MEM",
    "Siprofloksasiini": "CIP",
    "Trimetopriimi": "TMP",
    "Nitrofurantoiini": "NIT",
    "Vankomysiini": "VAN",
    "Klindamysiini": "CLI",
}


def concept_codes(oid: str) -> list[dict]:
    """Every code in a code list: {"code", "expires", attribute name: first value, ...}."""
    out: list[dict] = []
    page, pages = 1, 1
    while page <= pages:
        with urllib.request.urlopen(f"{API}/{oid}/conceptcodes?pageSize=500&page={page}", timeout=60) as res:
            body = json.load(res)
        pages = body["totalPages"]
        for c in body["conceptCodes"]:
            attrs = {a["attributeName"]: (a["attributeValue"] or [""])[0] for a in c["attributes"]}
            out.append({"code": c["conceptCodeId"], "expires": c.get("expirationDate"), **attrs})
        page += 1
    return out


def _match(codes: list[dict], wanted: dict[str, str], today: str) -> dict[str, dict]:
    active = [c for c in codes if (c["expires"] or "9999") > today]
    out: dict[str, dict] = {}
    for name, value in wanted.items():
        hits = [c for c in active if c.get("LongName", "").strip() == name]
        if len(hits) != 1:
            raise ValueError(f"{len(hits)} active codes named {name!r}")
        c = hits[0]
        out[c["code"]] = {"abbreviation": c.get("Abbreviation", ""), "name": name, "aei": value}
    return out


def thl_code_map(today: str | None = None) -> dict:
    """The codes of THL's microbe and antimicrobial lists that the dataset uses, keyed by THL code."""
    today = today or dt.date.today().isoformat()
    return {
        "source": f"THL code lists on the Kanta code server ({API}), fetched {today}",
        "microbes": {"system": MICROBES, "codes": _match(concept_codes(MICROBES), {o: o for o in ORGANISMS}, today)},
        "antimicrobials": {"system": ANTIMICROBIALS, "codes": _match(concept_codes(ANTIMICROBIALS), ANTIBIOTICS, today)},
    }
