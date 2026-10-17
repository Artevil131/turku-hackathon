"""D-066: packaged registry and public Python defaults stay in step with TS."""

import inspect
import json
from dataclasses import asdict
from pathlib import Path

from aei import methods, methods_registry
from aei import coverage_list, detect

ROOT = Path(__file__).resolve().parents[4]


def snake(name):
    return "".join("_" + c.lower() if c.isupper() else c for c in name)


def test_packaged_registry_matches_source_and_r():
    source = (ROOT / "libs/utils/methods/registry.json").read_bytes()
    assert (ROOT / "libs/utils/py/aei/registry.json").read_bytes() == source
    assert (ROOT / "libs/utils/r/inst/registry.json").read_bytes() == source
    assert methods_registry() == json.loads(source)
    changed = methods_registry()
    changed[0]["name"]["en"] = "mutated"
    assert methods_registry()[0]["name"]["en"] != "mutated"


def test_every_public_method_default_matches_registry():
    entries = {snake(entry["id"]): entry for entry in methods_registry()}
    assert set(methods.__all__) <= entries.keys()
    for name in methods.__all__:
        registered = {snake(p["name"]): p["default"] for p in entries[name]["parameters"]}
        for parameter in inspect.signature(getattr(methods, name)).parameters.values():
            default = parameter.default
            if default is inspect.Parameter.empty:
                continue  # required data/scope inputs are not algorithm defaults
            if parameter.name == "pairs":
                assert default is None
                effective = [{k: v for k, v in asdict(pair).items() if v is not None}
                             for pair in detect.SURVEILLANCE_PAIRS]
                assert effective == registered["pairs"]
            elif default is None:
                # None denotes an absent optional filter/window/ward registry,
                # not a numerical method setting; these remain contextual inputs.
                assert parameter.name in {"window", "wards", "sex", "age_group"}
                assert parameter.name not in registered
            else:
                if isinstance(default, tuple):
                    default = list(default)
                assert default == registered[parameter.name], f"{name}.{parameter.name}"


def test_fixed_python_thresholds_match_registry():
    entries = {entry["id"]: {p["name"]: p["default"] for p in entry["parameters"]}
               for entry in methods_registry()}
    assert entries["suggest"]["mild"] == coverage_list.THRESHOLDS["mild"]
    assert entries["suggest"]["severe"] == coverage_list.THRESHOLDS["severe"]
    assert entries["suggest"]["maxUntested"] == coverage_list.MAX_UNTESTED
    assert entries["suggestCombinations"]["minPartnerGain"] == coverage_list.MIN_PARTNER_GAIN
