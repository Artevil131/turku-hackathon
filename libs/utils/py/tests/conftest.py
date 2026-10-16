"""Shared fixtures: the dataset, and the TypeScript gears' output on it (ts_dump.ts), started in the background as
soon as the session begins so Node and the Python mirrors run side by side."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from aei.dataset import load_records

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / "data" / "synthetic_microbiology_dataset"
DUMP = Path(__file__).with_name("ts_dump.ts")

_node: subprocess.Popen | None = None


def pytest_configure(config: pytest.Config) -> None:
    global _node
    if (DATA / "isolates.csv").exists():
        _node = subprocess.Popen(["node", str(DUMP), str(DATA)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def pytest_unconfigure(config: pytest.Config) -> None:
    if _node is not None and _node.poll() is None:
        _node.kill()


@pytest.fixture(scope="session")
def dataset():
    if not (DATA / "isolates.csv").exists():
        pytest.skip(f"dataset not found at {DATA}")
    return load_records(DATA)


@pytest.fixture(scope="session")
def ts(dataset) -> dict:
    """The TypeScript gears' output (request after the Python fixtures, so both run at once)."""
    assert _node is not None
    out, err = _node.communicate()
    assert _node.returncode == 0, err
    return json.loads(out)
