"""aei.finres: the Finres JSON-stat parser on a saved response (2025, two genera, two specimens, four members), the
latest-year choice and the lookup by our species and codes. No network."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from aei.finres import (
    ANTIBIOTIC_IDS,
    SPECIES_GENUS,
    YEAR_IDS,
    cube_url,
    finres_view,
    national_cell,
    parse_cells,
)

FIXTURE = Path(__file__).with_name("fixtures") / "finres_2025_sample.json"


def sample() -> dict:
    return json.loads(FIXTURE.read_text())["dataset"]


def test_parses_cells_with_our_codes_and_nulls_where_the_cube_has_no_figure():
    cells = {(c["genus"], c["antibiotic"], c["specimen"]): c for c in parse_cells(sample())}
    assert len(cells) == 10
    assert cells[("Escherichia", "CIP", "urine")] == {
        "genus": "Escherichia", "antibiotic": "CIP", "specimen": "urine",
        "tests": 89634, "resistant": 6595, "pctR": 7.4, "interval": [7.2, 7.5], "year": 2025,
    }
    assert cells[("Escherichia", "NIT", "urine")]["pctR"] == 0.5
    tmp_blood = cells[("Escherichia", "TMP", "blood")]  # tested, %R not published
    assert tmp_blood["tests"] == 1616
    assert tmp_blood["resistant"] is None and tmp_blood["pctR"] is None and tmp_blood["interval"] is None
    assert cells[("Staphylococcus", "MRSA", "blood")]["pctR"] == 3.6


def test_unexpected_label_fails_loudly():
    ds = sample()
    ds["dimension"]["antibiotic"]["category"]["label"]["45671"] = "2009"  # an id the server resolved elsewhere
    with pytest.raises(ValueError, match="antibiotic"):
        parse_cells(ds)


def test_view_takes_the_latest_year_with_figures():
    asked = []

    def fetch(year: int) -> dict:
        asked.append(year)
        if year > 2025:
            empty = sample()
            empty["value"] = {}
            return empty
        return sample()

    view = finres_view(fetched="2026-10-17", fetch=fetch)
    assert asked == sorted((y for y in YEAR_IDS if y >= 2025), reverse=True)
    assert view["year"] == 2025 and view["fetched"] == "2026-10-17"
    assert "CC BY 4.0" in view["licence"] and "THL" in view["source"]
    assert all("year" not in c for c in view["cells"])


def test_lookup_maps_species_to_genus_and_cefoxitin_to_the_mrsa_flag():
    view = finres_view(fetched="2026-10-17", fetch=lambda year: sample())
    assert national_cell(view, "Escherichia coli", "TMP", "urine")["pctR"] == 18.7
    assert national_cell(view, "Staphylococcus aureus", "FOX", "blood")["antibiotic"] == "MRSA"
    assert national_cell(view, "Proteus mirabilis", "CIP", "urine") is None  # no genus in Finres
    assert national_cell(view, "Escherichia coli", "CIP", "wound") is None  # not in this sample
    assert SPECIES_GENUS["Klebsiella oxytoca"] == "Klebsiella"


def test_url_addresses_members_by_id_with_trailing_dots():
    url = cube_url(2025)
    assert "row=time-26.&" in url and "row=spec_type-195.190.191.&" in url
    assert "column=antibiotic-" + "".join(f"{i}." for i in ANTIBIOTIC_IDS.values()) in url
    assert "L" not in url.split("?", 1)[1]
