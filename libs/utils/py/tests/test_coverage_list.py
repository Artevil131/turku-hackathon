"""`aei.coverage_list` mirrors `@aei/coverage` (D-023, D-026 to D-028, D-033): the same shares, intervals, orders and ties.

Two checks against the TypeScript, both on the full dataset and skipped without it or without Node:

- experiments/0010's month loop, run in Python exactly as `backtest.ts` runs it, gives every row and combination of
  the `rows.json` that `backtest.ts` writes, field by field, floats within 1e-12. The script runs in a temporary
  working directory (its data and output paths are relative to it, its imports to its own file), so it never writes the
  git-ignored `out/rows.json` in the repository that other sessions read;
- 405 queries over sex filters, windows and minimum sizes (`coverage`, `suggest`, `suggestCombinations`), run through
  Node from a short script, give the same figures.

The rest are rules of the list on made-up shares, which need no data.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from aei import coverage_list as cl

ROOT = Path(__file__).resolve().parents[4]
BACKTEST = ROOT / "experiments" / "0010-coverage-as-shipped" / "backtest.ts"
DATA = ROOT / "data" / "synthetic_microbiology_dataset"
NEEDS_NODE = pytest.mark.skipif(shutil.which("node") is None, reason="node not found")


def assert_same(ts: object, py: object, path: str = "") -> None:
    """Equal values; floats within 1e-12; None only for None."""
    if isinstance(ts, float) or isinstance(py, float):
        assert ts is not None and py is not None, f"{path}: {ts!r} != {py!r}"
        assert abs(ts - py) <= 1e-12, f"{path}: {ts!r} != {py!r}"  # type: ignore[operator]
    else:
        assert ts == py, f"{path}: {ts!r} != {py!r}"


# --- the month loop of experiments/0010 -------------------------------------------------------------------------------


@pytest.fixture(scope="session")
def month_loop(dataset):
    records, _ = dataset
    return cl.month_loop(records)


@pytest.fixture(scope="session")
def ts_rows(dataset, tmp_path_factory):
    """What `backtest.ts` writes, from a run whose working directory is a temporary one: `data` links to the repository's,
    `experiments/0010-coverage-as-shipped/out/` is empty and ours (harness review, finding 17)."""
    if shutil.which("node") is None:
        pytest.skip("node not found")
    work = tmp_path_factory.mktemp("backtest-0010")
    (work / "data").symlink_to(ROOT / "data")
    out = work / "experiments" / "0010-coverage-as-shipped" / "out"
    out.mkdir(parents=True)
    run = subprocess.run(["node", str(BACKTEST)], cwd=work, capture_output=True, text=True, timeout=600)
    assert run.returncode == 0, run.stderr
    return json.loads((out / "rows.json").read_text())


@NEEDS_NODE
def test_month_loop_rows_match_typescript(month_loop, ts_rows):
    rows, _ = month_loop
    assert len(rows) == len(ts_rows["rows"]) == 7525
    for i, (t, p) in enumerate(zip(ts_rows["rows"], rows, strict=True)):
        assert t.keys() == p.keys()
        for k in t:
            assert_same(t[k], p[k], f"row {i} {k}")


@NEEDS_NODE
def test_month_loop_combinations_match_typescript(month_loop, ts_rows):
    _, combos = month_loop
    assert len(combos) == len(ts_rows["combos"]) == 191
    for i, (t, p) in enumerate(zip(ts_rows["combos"], combos, strict=True)):
        assert t.keys() == p.keys()
        for k in t:
            assert_same(t[k], p[k], f"combo {i} {k}")


# --- coverage, suggest and suggestCombinations over sex filters, windows and minimum sizes ---------------------------------

TS_QUERIES = """
import { coverage, suggest, suggestCombinations } from "%(coverage)s";
import { joinIsolates, loadDataset } from "%(dataset)s";
const records = joinIsolates(await loadDataset("%(data)s"));
const out = [];
for (const asOf of ["2025-01-31", "2025-08-31", "2026-06-30"])
  for (const ward of ["ED", "URO", "ICU", "PHC-N", "GER"])
    for (const specimen of ["urine", "blood", "wound"])
      for (const sex of [undefined, "F", "M"])
        for (const [windowDays, minTested] of [[365, 30], [180, 20], [28, 5]]) {
          const q = { asOf, ward, specimen, sex, windowDays, minTested };
          const r = coverage(records, q);
          const sug = (s) => s.map((x) => [x.antibiotic, x.standing, x.share, x.interval, x.allOrganisms.share, x.allOrganisms.interval]);
          out.push({
            q, level: r.level, isolates: r.isolates, sexApplied: r.sexApplied, from: r.from,
            organisms: r.organisms.map((o) => [o.organism, o.isolates, o.share]),
            antibiotics: r.antibiotics.map((a) => [a.antibiotic, a.share, a.interval, [a.counts.covered, a.counts.known], a.spectrum.share, a.spectrum.interval,
              [a.recent.covered, a.recent.known], a.untested.map((u) => [u.organism, u.share]), a.notCovering.map((u) => [u.organism, u.share]),
              a.outsideSpectrum.map((u) => [u.organism, u.share])]),
            combinations: r.combinations.map((c) => [c.antibiotics, c.share, c.interval, [c.counts.covered, c.counts.known], c.alone, c.untested]),
            mild: sug(suggest(r, "mild")), severe: sug(suggest(r, "severe")),
            pairs: suggestCombinations(r, "severe").map((c) => [c.antibiotics, c.access, c.standing, c.gain]),
          });
        }
console.log(JSON.stringify(out));
"""


@pytest.fixture(scope="session")
def ts_queries(dataset):
    if shutil.which("node") is None:
        pytest.skip("node not found")
    src = TS_QUERIES % {
        "coverage": (ROOT / "libs/utils/coverage/src/index.ts").as_posix(),
        "dataset": (ROOT / "libs/utils/dataset/src/index.ts").as_posix(),
        "data": DATA.as_posix(),
    }
    run = subprocess.run(["node", "--input-type=module", "--eval", src], cwd=ROOT, capture_output=True, text=True, timeout=600)
    assert run.returncode == 0, run.stderr
    return json.loads(run.stdout)


def lst(x):
    return None if x is None else list(x)


@NEEDS_NODE
def test_coverage_suggest_and_combinations_match_typescript(dataset, ts_queries):
    records, _ = dataset
    assert len(ts_queries) == 405
    saw = {"sex_applied": 0, "pairs": 0, "levels": set()}
    for t in ts_queries:
        q = t["q"]
        r = cl.coverage(
            records, as_of=q["asOf"], ward=q["ward"], specimen=q["specimen"], sex=q.get("sex"), window_days=q["windowDays"], min_tested=q["minTested"]
        )
        where = json.dumps(q)
        assert (r.level, r.isolates, r.sex_applied, r.from_) == (t["level"], t["isolates"], t["sexApplied"], t["from"]), where
        assert_same(t["organisms"], [list(o) for o in r.organisms], where + " organisms")
        mine = [
            [
                a.antibiotic, a.share, lst(a.interval), [a.counts.covered, a.counts.known], a.spectrum.share, lst(a.spectrum.interval),
                [a.recent.covered, a.recent.known], [list(u) for u in a.untested], [list(u) for u in a.not_covering], [list(u) for u in a.outside_spectrum],
            ]
            for a in r.antibiotics
        ]  # fmt: skip
        assert_same(t["antibiotics"], mine, where + " antibiotics")
        mine = [[list(c.antibiotics), c.share, lst(c.interval), [c.counts.covered, c.counts.known], list(c.alone), c.untested] for c in r.combinations]
        assert_same(t["combinations"], mine, where + " combinations")
        for sev in ("mild", "severe"):
            mine = [[s.antibiotic, s.standing, s.share, lst(s.interval), s.all_share, lst(s.all_interval)] for s in cl.suggest(r, sev)]
            assert_same(t[sev], mine, where + sev)
        pairs = [[list(c.antibiotics), c.access, c.standing, c.gain] for c in cl.suggest_combinations(r, "severe")]
        assert_same(t["pairs"], pairs, where + " pairs")
        saw["sex_applied"] += r.sex_applied
        saw["pairs"] += bool(pairs)
        saw["levels"].add(r.level)
    # the queries exercise the branches: the sex filter applied, pairs suggested, all three levels
    assert saw["sex_applied"] > 100 and saw["pairs"] > 100 and saw["levels"] == {"unit", "ward type", "hospital"}


# --- the rules of the list, on made-up shares ----------------------------------------------------------------------------


def row(a: str, share: float | None, lo: float | None, hi: float | None = None, untested: float = 0.0, *, spectrum: tuple | None = None) -> cl.Row:
    iv = None if share is None or lo is None else (lo, hi if hi is not None else min(1.0, share + 0.02))
    sp = spectrum or (share, iv)
    return cl.Row(a, share, iv, sp[0], sp[1], untested)


def order(rows: list[cl.Row], severity: str) -> list[tuple[str, str]]:
    return [(s.antibiotic, s.standing) for s in cl.suggest_rows(rows, severity)]


def test_standings_and_order():
    rows = [
        row("TZP", 0.99, 0.97),  # Watch, clears 90 %
        row("AMP", 0.93, 0.91),  # Access, clears 90 %, lower coverage than TZP
        row("MEM", 0.95, 0.88),  # estimate clears, interval does not: borderline
        row("CIP", 0.80, 0.75),  # below
        row("CXM", 0.97, 0.95, untested=0.25),  # over a fifth untested: not assessable whatever its share
        row("CRO", None, None),  # no estimate: not assessable
    ]
    assert order(rows, "severe") == [
        ("AMP", "clears"),  # Access before Watch among those that clear, although TZP covers more
        ("TZP", "clears"),
        ("MEM", "borderline"),
        ("CIP", "below"),
        ("CXM", "not assessable"),  # not assessable last, in all-organism share order
        ("CRO", "not assessable"),
    ]
    # a share exactly on the threshold clears when its interval does
    assert order([row("AMP", 0.9, 0.9)], "severe") == [("AMP", "clears")]
    # the gate is "over a fifth": exactly 0.2 still counts
    assert order([row("AMP", 0.95, 0.93, untested=0.2)], "severe") == [("AMP", "clears")]


def test_mild_uses_the_spectrum_and_drops_injection_only_drugs():
    rows = [
        row("MEC", 0.60, 0.58, spectrum=(0.97, (0.96, 0.98))),  # all organisms 60 %, within spectrum 97 %
        row("TZP", 0.99, 0.98),  # IV only
        row("NIT", 0.88, 0.86),
    ]
    mild = cl.suggest_rows(rows, "mild")
    assert [s.antibiotic for s in mild] == ["MEC", "NIT"]  # both Access: by spectrum share, TZP left out
    assert mild[0].basis == "spectrum" and mild[0].share == 0.97 and mild[0].all_share == 0.60
    severe = cl.suggest_rows(rows, "severe")
    assert severe[0].antibiotic == "TZP" and severe[0].basis == "all organisms"
    assert {s.antibiotic for s in severe} == {"MEC", "TZP", "NIT"}


def test_ties_keep_the_order_coverage_gives_antibiotics():
    # equal all-organism shares: input order breaks the tie, as the TypeScript's stable sorts do
    a, b = row("CIP", 0.95, 0.93), row("MEM", 0.95, 0.93)
    assert [s.antibiotic for s in cl.suggest_rows([a, b], "severe")] == ["CIP", "MEM"]
    assert [s.antibiotic for s in cl.suggest_rows([b, a], "severe")] == ["MEM", "CIP"]
    # rows given out of order are first sorted by all-organism share (the order coverage() returns)
    lo, hi = row("CIP", 0.91, 0.9), row("MEM", 0.99, 0.95)
    assert [s.antibiotic for s in cl.suggest_rows([lo, hi], "severe")] == ["MEM", "CIP"]


def test_sum_runs_left_to_right_like_reduce():
    # Python's sum() is compensated from 3.12 and would give 1.0 here; reduce((s, x) => s + x, 0) gives 0.0
    assert cl._sum_in_order([1e16, 1.0, -1e16]) == 0.0


def test_organism_shares_order():
    # largest first, ties in order of first appearance
    out = cl.organism_shares(["B", "A", "A", "C", "B", "D"], 10)
    assert out == [("B", 0.2), ("A", 0.2), ("C", 0.1), ("D", 0.1)]


def test_month_ends():
    months = cl.month_ends()
    assert len(months) == 24
    assert months[0] == ("2024-09-30", "2024-10", "2024-10-31", 31)
    assert months[-1] == ("2026-08-31", "2026-09", "2026-09-30", 30)
    assert ("2025-01-31", "2025-02", "2025-02-28", 28) in months
    assert ("2025-12-31", "2026-01", "2026-01-31", 31) in months


def test_offered_leaves_out_what_does_not_suit_or_is_not_offered():
    assert "FOX" not in cl.offered("blood") and "VAN" not in cl.offered("urine") and "CLI" not in cl.offered("urine")
    assert "VAN" in cl.offered("wound") and "MEC" in cl.offered("urine") and "MEC" not in cl.offered("blood")
