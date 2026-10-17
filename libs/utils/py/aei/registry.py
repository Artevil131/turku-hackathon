"""The language-neutral live method registry (D-066), shipped as package data."""

import json
from importlib.resources import files


def methods_registry():
    """Return the registered method definitions, parameters and provenance.

    This is the TypeScript registry snapshot, not another set of method
    defaults. Each call returns fresh objects so callers cannot mutate the
    process-wide source of truth.
    """
    return json.loads(files("aei").joinpath("registry.json").read_text(encoding="utf-8"))
