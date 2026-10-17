"""Tests of aei.score_detection and the generic trials of aei.inject (the detection part of the overnight harness).

The acceptance tests rerun experiments 0007 (seed 2026, 40 trials per cell, its loop order) and 0011 (seeds 2026 to 2028,
20 trials per seed, its loop) through the generic trials with the live set as the detector and require every row of their
committed results.md. The new-in-unit port and the incident grouping are compared with what `@aei/alerts` gives on the same
data (dumped from `buildAlerts` and `newInUnitAlerts` on 2026-10-17). The data fixture is `conftest.dataset`; every test
skips when the data is missing.
Run from the repository root:  uv run pytest libs/utils/py/tests/test_score_detection.py
"""

from __future__ import annotations

import dataclasses
import subprocess
from collections import Counter
from functools import lru_cache
from pathlib import Path

import pytest

from aei import harness, inject
from aei import score_detection as sd
from aei.coverage import wilson
from aei.detect import Signal, live_signals
from aei.dates import add_days, days_between
from aei.domain import UNITS, WARD_TYPE
from aei.inject import Focus, TrialHits, base_of, common_hits, gap_hits, rare_hits, seed_trials, two_unit_hits, ward_in
from aei.jscompat import js_round, mulberry32, table

ROOT = Path(__file__).resolve().parents[4]


@lru_cache(maxsize=None)
def committed(rel_path: str) -> str | None:
    """A reference file as committed (`git show HEAD:<path>`), not as the working tree has it: another session or
    `verify_experiments.py` may be rewriting the working copy (harness review, finding 17). None when it is not in HEAD."""
    run = subprocess.run(["git", "-C", str(ROOT), "show", f"HEAD:{rel_path}"], capture_output=True, text=True, encoding="utf-8")
    return run.stdout if run.returncode == 0 else None


# ---------- fixtures ----------


@pytest.fixture(scope="session")
def live() -> sd.LiveSet:
    return sd.LiveSet()


@pytest.fixture(scope="session")
def base(dataset):
    records, cultures = dataset
    return base_of(records, cultures)


@pytest.fixture(scope="session")
def full_signals(dataset, live):
    """The live set on all the data at its loosest level (m = 100)."""
    records, cultures = dataset
    return live.run(records, cultures)


def table_lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line.startswith("|")]


def median(xs: list[int]) -> int | None:
    s = sorted(xs)
    return s[(len(s) - 1) >> 1] if s else None


# ---------- acceptance: experiment 0007 ----------

SIZE = {"ED": "large", "PHC-N": "large", "PHC-S": "large", "MED-A": "medium", "SURG": "medium", "URO": "medium", "GER": "medium", "MED-B": "small", "ICU": "small"}


@pytest.fixture(scope="session")
def trials_0007(dataset, base, live):
    """0007's loop: clusters k 0, 2, 3, 4, 6 then the gap settings, 40 trials each, one mulberry32(2026) stream."""
    rand = mulberry32(2026)
    out: list[tuple[str, list[TrialHits]]] = []
    n = 0
    for k in (0, 2, 3, 4, 6):
        ts = []
        for _ in range(40):
            ts.append(rare_hits(live, base, rand, k, n))
            n += 1
        out.append((f"cluster k = {k}", ts))
    for days, halve in inject.GAP_SETTINGS:
        ts = [inject.gap_hits(live, base, rand, days, halve) for _ in range(40)]
        out.append((ts[0].setting, ts))
    return out


def test_0007_reproduced_row_by_row(trials_0007, live):
    """Every row of 0007's results.md: detected with its Wilson interval, median delay, delay range, large, medium, small."""
    text = committed("experiments/0007-injected-events/out/results.md")
    if text is None:
        pytest.skip("0007 results not committed")
    # 0007 counted only the live profile and phenotype excess for clusters and the 7-day sampling drop for gaps, at the
    # shipped alphas; the live set now also has new-in-unit and the empty-run rule, which are read separately.
    cluster = lambda s: s.detector in ("profile-excess", "phenotype-excess") and live.passes(s, 1.0)  # noqa: E731
    drop = lambda s: s.detector == "sampling-drop" and live.passes(s, 1.0)  # noqa: E731
    rows = []
    for setting, ts in trials_0007:
        accept = drop if ts[0].family == "gap" else cluster
        label = f"cluster {setting}" if setting.startswith("k = ") else setting
        k = sum(1 for t in ts if t.detected(accept))
        lo, hi = wilson(k, len(ts))
        delays = [t.delay(accept) for t in ts if t.detected(accept)]
        by_size = []
        for z in ("large", "medium", "small"):
            sub = [t for t in ts if SIZE[t.units[0]] == z]
            by_size.append(f"{sum(1 for t in sub if t.detected(accept))}/{len(sub)}")
        med = median(delays)
        rows.append([label, f"{k}/{len(ts)} ({js_round(100 * lo)}–{js_round(100 * hi)} %)", "–" if med is None else med, f"{min(delays)}–{max(delays)}" if delays else "–", *by_size])
    expected = table_lines(text)
    mine = table(["setting", "detected", "median delay", "delay range", "large units", "medium units", "small units"], rows).splitlines()
    assert len(mine) == len(expected) == 13
    assert mine == expected


# ---------- acceptance: experiment 0011 ----------

LARGE = ("ED", "PHC-N", "PHC-S")
OTHER = ("MED-A", "MED-B", "SURG", "URO", "ICU", "GER")
ARMS = (("common resistant", "common_resistant"), ("wild type", "wild_type"), ("common ESBL E. coli", "common_esbl"))


@pytest.fixture(scope="session")
def trials_0011(dataset, base, live):
    """0011's loop: seeds 2026 to 2028, arms, k in 0, 3, 4, 6, 8, 20 trials each (half large, half other units)."""
    rows = []
    n = 0
    for seed in (2026, 2027, 2028):
        rand = mulberry32(seed)
        for _, arm in ARMS:
            for k in (0, 3, 4, 6, 8):
                for i in range(20):
                    stratum, units = ("large", LARGE) if i % 2 == 0 else ("other", OTHER)
                    rows.append((seed, arm, k, common_hits(live, base, rand, arm, k, units, n, stratum)))
                    n += 1
    return rows


def test_0011_reproduced_table_by_table(trials_0011, live):
    text = committed("experiments/0011-common-profile-injections/out/results.md")
    if text is None:
        pytest.skip("0011 results not committed")
    accept = lambda s: s.detector in ("profile-excess", "phenotype-excess") and live.passes(s, 1.0)  # noqa: E731

    def rate(ts: list[TrialHits], strict: bool = False) -> str:
        k = sum(1 for t in ts if (t.strict(accept) if strict else t.detected(accept)))
        lo, hi = wilson(k, len(ts))
        return f"{k}/{len(ts)} ({js_round(100 * lo)}–{js_round(100 * hi)} %)"

    rows = []
    for name, arm in ARMS:
        for k in (0, 3, 4, 6, 8):
            sub = [r for r in trials_0011 if r[1] == arm and r[2] == k]
            ts = [r[3] for r in sub]
            per_seed = " / ".join(str(sum(1 for r in sub if r[0] == s and r[3].detected(accept))) for s in (2026, 2027, 2028))
            strata = [f"{sum(1 for r in sub if r[3].stratum == z and r[3].detected(accept))}/{sum(1 for r in sub if r[3].stratum == z)}" for z in ("large", "other")]
            med = median([t.delay(accept) for t in ts if t.detected(accept)])
            rows.append([name, "control" if k == 0 else k, rate(ts), per_seed, *strata, rate(ts, strict=True), "–" if med is None else med])
    pooled = []
    for name, arm in ARMS:
        sub = [r for r in trials_0011 if r[1] == arm and r[2] >= 4]
        pooled.append([name, rate([r[3] for r in sub]), rate([r[3] for r in sub if r[3].stratum == "large"]), rate([r[3] for r in sub if r[3].stratum == "other"])])
    expected = table_lines(text)
    mine = (
        table(["arm", "k", "detected", "per seed", "large units", "other units", "strict", "median delay"], rows).splitlines()
        + table(["arm", "all units", "large units", "other units"], pooled).splitlines()
    )
    assert len(rows) == 15
    assert mine == expected


# ---------- the live set as a detector ----------


def test_live_set_at_level_one_is_the_shipped_set(full_signals, live, dataset):
    """The signals passing at level 1 are live_signals (same keys, dates, observed, p), plus new-in-unit."""
    records, cultures = dataset
    shipped = [s for s in full_signals if live.passes(s, 1.0)]
    ref = live_signals(records, cultures)
    key = lambda s: (s.detector, s.key, s.date, s.observed)  # noqa: E731
    mine = sorted((s for s in shipped if s.detector != "new-in-unit"), key=key)
    theirs = sorted(ref, key=key)
    assert [key(s) for s in mine] == [key(s) for s in theirs]
    assert all(a.p == pytest.approx(b.p, rel=1e-12) for a, b in zip(mine, theirs, strict=True))
    assert Counter(s.detector for s in full_signals if s.detector == "new-in-unit") == {"new-in-unit": 8}


def test_levels_loosen_cluster_alphas_only(full_signals, live):
    counts = [sum(1 for s in full_signals if live.kind_of(s) == "cluster" and live.passes(s, m)) for m in live.levels]
    assert counts == sorted(counts, reverse=True) and counts[0] > counts[4] > counts[-1]
    # the other kinds do not move with the level
    for kind in ("data", "trend", "sentinel"):
        assert len({sum(1 for s in full_signals if live.kind_of(s) == kind and live.passes(s, m)) for m in live.levels}) == 1


# TS `newInUnitAlerts` on the dataset: date, unit, phenotype
TS_NEW_IN_UNIT = [
    ("2024-04-09", "MED-B", "mrsa"),
    ("2024-05-12", "MED-A", "mrsa"),
    ("2024-08-26", "URO", "mrsa"),
    ("2024-09-14", "GER", "mrsa"),
    ("2025-01-19", "ICU", "mrsa"),
    ("2026-03-03", "ICU", "mrsa"),
    ("2026-09-23", "MED-A", "mrsa"),
    ("2026-09-11", "GER", "vre"),
]
# TS `buildAlerts`: alerts by kind and the sizes of its 37 incidents
TS_ALERT_KINDS = {"detector": 21, "cpe": 12, "new-in-unit": 8}
TS_INCIDENT_SIZES = [1] * 34 + [2, 2, 3]


def test_new_in_unit_matches_typescript(dataset):
    records, _ = dataset
    got = [(s.date, s.ward, s.phenotype) for s in sd.new_in_unit_signals(records)]
    assert got == TS_NEW_IN_UNIT
    assert sd.new_in_unit_signals([]) == []
    # silent for the first 180 days of the data, and only inpatient units
    assert all(d >= add_days("2023-10-02", 180) for d, _, _ in got)
    assert all(WARD_TYPE[w] == "in" for _, w, _ in got)
    # a 30-day look-back fires more often (D-021's note)
    assert len(sd.new_in_unit_signals(records, lookback_days=30)) > len(got)


def test_incidents_match_typescript(dataset, full_signals, live):
    records, _ = dataset
    shipped = [s for s in full_signals if live.passes(s, 1.0)]
    alerts = sd.build_alerts(records, shipped, live)
    assert Counter(a.kind for a in alerts) == TS_ALERT_KINDS
    assert sorted(Counter(a.incident for a in alerts).values()) == TS_INCIDENT_SIZES


def test_group_incidents_rules():
    A = sd.Alert
    alerts = [
        A("a", "2025-01-01", "ICU", "detector", organism="Staphylococcus aureus"),
        A("b", "2025-01-10", "ICU", "detector", phenotype="mrsa"),  # a phenotype implies its organisms
        A("c", "2025-01-12", "URO", "detector", phenotype="mrsa"),  # another unit
        A("d", "2025-03-01", "ICU", "detector", organism="Staphylococcus aureus"),  # more than 28 days after the last
        A("e", "2025-03-02", "ICU", "detector", sampling=True),  # sampling shares only its own tag
        A("f", "2025-03-20", "ICU", "detector", sampling=True),
        A("g", "2025-03-21", None, "detector", sampling=True),  # hospital-wide never joins
    ]
    out = {a.id: a.incident for a in sd.group_incidents(alerts)}
    assert out == {"a": "a", "b": "a", "c": "c", "d": "d", "e": "e", "f": "e", "g": "g"}


def test_cpe_is_an_alert_of_the_tool(dataset):
    records, _ = dataset
    assert len(sd.cpe_alerts(records)) == sum("cpe" in r.phenotypes for r in records) == 12


# ---------- focused runs ----------


class Spy(sd.LiveSet):
    """The live set that keeps the data and focus of its last focused run."""

    captured = None

    def run(self, records, cultures, focus=None):
        if focus is not None:
            Spy.captured = (records, cultures, focus)
        return super().run(records, cultures, focus)


def test_focused_run_gives_the_signals_of_a_full_run(dataset, base, live):
    """On the data of a trial, the focused run's signals for the trial's units and window are those of a run on all of it.
    Profile excess is computed for the focus' organism and specimen only (0007's rule), so the check frees the specimen."""
    spy = Spy()
    rand = mulberry32(11)
    checked = 0
    for i in range(24):
        if i % 4 == 0:
            h = rare_hits(spy, base, rand, 4, i)
        elif i % 4 == 1:
            h = two_unit_hits(spy, base, rand, 4, i)
        elif i % 4 == 2:
            h = gap_hits(spy, base, rand, [3, 5, 7][i % 3], i % 2 == 1, i)
        else:
            h = common_hits(spy, base, rand, ["common_resistant", "wild_type", "common_esbl"][i % 3], 4, LARGE if i % 2 else OTHER, i)
        recs, cults, focus = Spy.captured
        key = lambda s: (s.detector, s.key, s.date, s.ward, s.observed, s.p)  # noqa: E731

        def mine(signals):
            return sorted(
                key(s)
                for s in signals
                if ward_in(s.ward, h.units)
                and h.start <= s.date <= h.until
                and (h.family == "gap" and s.detector != "rising-trend" or h.family != "gap" and (s.organism == h.organism or (s.phenotype is not None and s.phenotype in h.phenotypes)))
            )

        freed = live.run(recs, cults, dataclasses.replace(focus, specimen=None))
        assert mine(freed) == mine(live.run(recs, cults, None))
        assert set(map(key, h.signals)) <= set(mine(freed))
        checked += 1
    assert checked == 24


def test_common_group_on_slices_equals_0011s(dataset, base):
    records, _ = dataset
    rand = mulberry32(5)
    for _ in range(25):
        unit = UNITS[inject._pick_int(rand, len(UNITS))]
        start = inject.draw_start(rand, unit, inject.CLUSTER_AVOID)
        for kind in inject.COMMON_KINDS:
            a = inject.common_group(records, unit, start, kind)
            b = base.common_group(unit, start, kind)
            assert [r.isolate_id for r in a] == [r.isolate_id for r in b]


def test_existing_trials_keep_their_draws(dataset, base, live):
    """The generic trials draw as the first ones do, so the same seed gives the same unit, start and source."""
    records, _ = dataset
    cluster = lambda s: s.detector in ("profile-excess", "phenotype-excess") and live.passes(s, 1.0)  # noqa: E731
    for seed in (1, 7, 2026):
        old = inject.cluster_trial(records, inject.clones(records), mulberry32(seed), 4, 0)
        new = rare_hits(live, base, mulberry32(seed), 4, 0)
        assert old.unit == new.units[0]
        assert (old.detected, old.first, old.delay) == (new.detected(cluster), new.first(cluster), new.delay(cluster))


# ---------- the new trials ----------


def test_injected_patients_get_a_culture_row_each(dataset, base):
    spy = Spy()
    h = rare_hits(spy, base, mulberry32(3), 6, 0)
    recs, cults, focus = Spy.captured
    inj = [r for r in recs if r.isolate_id.startswith("INJ")]
    assert len(inj) == 6 and len({r.culture_id for r in inj}) == 6
    inj_cultures = [c for c in cults if c.culture_id.startswith("INJ")]
    assert {c.culture_id for c in inj_cultures} == {r.culture_id for r in inj}
    assert all(c.ward == h.units[0] and c.specimen == inj[0].specimen for c in inj_cultures)
    assert all(h.start <= c.sample_date <= add_days(h.start, 13) for c in inj_cultures)
    # the data stays in date order and stops at the window's end
    assert [r.sample_date for r in recs] == sorted(r.sample_date for r in recs)
    assert recs[-1].sample_date <= h.until and cults[-1].sample_date <= h.until
    assert focus == Focus(h.units, h.organism, h.phenotypes, inj[0].specimen, h.start, h.until, base.data_start)


def test_control_trials_inject_nothing(dataset, base):
    spy = Spy()
    h = rare_hits(spy, base, mulberry32(3), 0, 0)
    recs, cults, _ = Spy.captured
    assert not any(r.isolate_id.startswith("INJ") for r in recs) and h.onset == h.start


def test_two_unit_trials(dataset, base):
    spy = Spy()
    rand = mulberry32(2026)
    seen = Counter()
    for t in range(40):
        k = (2, 3, 4, 6)[t % 4]
        h = two_unit_hits(spy, base, rand, k, t)
        recs, cults, focus = Spy.captured
        a, b = h.units
        assert a != b and {a, b} <= set(UNITS)
        inj = [r for r in recs if r.isolate_id.startswith(f"INJ{t}-")]
        assert [sum(1 for r in inj if r.ward == u) for u in (a, b)] == [-(-k // 2), k // 2]  # ceil(k/2) in A, floor(k/2) in B
        assert len({(r.organism, r.specimen, tuple(sorted(r.results.items()))) for r in inj}) == 1  # one clone
        # B is a patient-flow neighbour of A in the year before the start, both directions
        assert b in {u for u, _ in base.neighbours(a, h.start)}
        assert not any(u == b and abs(days_between(c, h.start)) <= 45 for u, c in inject.CLUSTER_AVOID)
        assert focus.units == (a, b)
        seen[(a, b)] += 1
    assert len({u for pair in seen for u in pair}) >= 5


def test_two_unit_matching_takes_plus_sets_and_either_unit(dataset, base):
    """A signal for A, for B, or for a '+' set containing either counts; one for other units or another organism does not."""
    probe: dict = {}

    def run_fn(records, cultures, focus):
        probe["focus"] = focus
        a, b = focus.units
        d = add_days(focus.start, 3)
        probe["sigs"] = [
            Signal("x", "k1", d, a, 3, organism=focus.organism, p=0.1),
            Signal("x", "k2", d, "+".join(sorted((b, "ZZ"))), 3, organism=focus.organism, p=0.2),
            Signal("x", "k3", d, "AA+ZZ", 3, organism=focus.organism, p=0.3),
            Signal("x", "k4", d, a, 3, organism="Some other organism", p=0.4),
            Signal("x", "k5", add_days(focus.end, 1), a, 3, organism=focus.organism, p=0.5),
        ]
        return probe["sigs"]

    det = sd.Detector("probe", run_fn, (1.0,), kind_fn=lambda s: "cluster")
    h = two_unit_hits(det, base, mulberry32(9), 4, 0)
    assert [s.key for s in h.signals] == ["k1", "k2"]
    assert h.detected(lambda s: s.p < 0.15) and not h.detected(lambda s: s.p > 0.25)
    assert h.delay() == max(0, days_between(h.onset, add_days(h.start, 3)))


def test_gap_trials_remove_the_isolates_with_their_cultures(dataset, base):
    spy = Spy()
    rand = mulberry32(21)
    h = gap_hits(spy, base, rand, 5, False)
    recs, cults, focus = Spy.captured
    (unit,) = h.units
    end = add_days(h.start, 4)
    before_c = [c for c in base.cultures if c.ward == unit and h.start <= c.sample_date <= end]
    after_c = [c for c in cults if c.ward == unit and h.start <= c.sample_date <= end]
    assert before_c and not after_c
    assert not [r for r in recs if r.ward == unit and h.start <= r.sample_date <= end]
    other_before = [c for c in base.cultures if c.ward != unit and h.start <= c.sample_date <= end]
    assert len([c for c in cults if c.ward != unit and h.start <= c.sample_date <= end]) == len(other_before)  # others untouched
    assert recs[-1].sample_date <= h.until
    # halved: every second culture of the unit goes, with its isolates
    h2 = gap_hits(spy, base, rand, 7, True)
    recs2, cults2, _ = Spy.captured
    (u2,) = h2.units
    window = lambda cs: [c for c in cs if c.ward == u2 and h2.start <= c.sample_date <= add_days(h2.start, 6)]  # noqa: E731
    kept, all_ = window(cults2), window(base.cultures)
    assert len(kept) == (len(all_) + 1) // 2 and all_[0].culture_id == kept[0].culture_id
    kept_ids = {c.culture_id for c in kept}
    assert {r.culture_id for r in recs2 if r.ward == u2 and h2.start <= r.sample_date <= add_days(h2.start, 6)} <= kept_ids
    # a control removes nothing
    gap_hits(spy, base, rand, 0, False)
    recs0, cults0, _ = Spy.captured
    assert [c.culture_id for c in cults0] == [c.culture_id for c in base.cultures[: len(cults0)]]
    assert [r.isolate_id for r in recs0] == [r.isolate_id for r in base.records[: len(recs0)]]


def test_draw_only_trials_consume_the_stream_like_run_trials(dataset, base, live):
    """A cell not asked for is drawn but not run, so cells do not depend on which others are requested."""
    records, cultures = dataset
    both = seed_trials(live, records, cultures, 2026, families=("rare", "two_unit"), ks=(0, 4), trials=6, gaps=((3, False),))
    only = seed_trials(live, records, cultures, 2026, families=("two_unit",), ks=(0, 4), trials=6, gaps=())
    assert [t.units for t in only["two_unit"][4]] == [t.units for t in both["two_unit"][4]]
    assert [t.start for t in only["two_unit"][4]] == [t.start for t in both["two_unit"][4]]
    drawn = seed_trials(None, records, cultures, 2026, families=("rare", "two_unit"), ks=(0, 4), trials=6, gaps=((3, False),))
    assert all(not t.ran for ts in drawn["two_unit"].values() for t in ts)
    assert [t.start for t in drawn["rare"][4]] == [t.start for t in both["rare"][4]]
    assert [t.units for t in drawn["gaps"][(3, False)]] == [t.units for t in both["gaps"][(3, False)]]
    # 0007's order inside one seed: the rare cells then the gaps, from one stream
    rand = mulberry32(2026)
    first = rare_hits(None, base, rand, 0, 0)
    assert both["rare"][0][0].start == first.start


# ---------- scoring ----------


def hit(p: float, detector: str = "profile-excess", day: str = "2025-03-04", ward: str = "ICU") -> Signal:
    return Signal(detector, "k", day, ward, 3, organism="O", p=p)


def test_levels_are_read_after_the_run():
    """A trial keeps its signals with p, so any level gives its detection and delay."""
    det = sd.Detector("p", lambda r, c, f: [], (1e-2, 1e-3, 1e-4), kind_fn=lambda s: "cluster")
    t = TrialHits("rare", "k = 4", 4, ("ICU",), "2025-03-01", "2025-03-29", "2025-03-02", "O", (), None, [hit(0.004, day="2025-03-09"), hit(0.0004, day="2025-03-12")])
    assert [t.detected(sd.accept_fn(det, lv)) for lv in det.levels] == [True, True, False]
    assert [t.delay(sd.accept_fn(det, lv)) for lv in det.levels] == [7, 10, None]
    assert not t.detected(sd.accept_fn(det, 1e-2, ("data",)))
    assert t.detected(sd.accept_fn(det, 1e-2, ("cluster", "sentinel")))


def test_episode_counts_use_the_fixed_key_zones_and_kinds():
    det = sd.Detector("s", lambda r, c, f: [], (1.0,), kind_fn=lambda s: sd.KIND_OF[s.detector])
    sigs = [
        # one episode: the same unit and organism within 28 days, whatever the detector's own key
        Signal("profile-excess", "ICU|O|x", "2025-02-01", "ICU", 3, organism="O", p=0.0),
        Signal("profile-excess", "ICU|O|y", "2025-02-20", "ICU", 3, organism="O", p=0.0),
        # a second one after a gap of more than 28 days
        Signal("profile-excess", "ICU|O|x", "2025-04-01", "ICU", 3, organism="O", p=0.0),
        # a phenotype signal for the same unit is its own episode (the phenotype is the tag)
        Signal("phenotype-excess", "ICU|esbl", "2025-02-02", "ICU", 3, phenotype="esbl", p=0.0),
        # a sentinel, by the kind of its first signal
        Signal("new-in-unit", "GER|vre", "2025-06-01", "GER", 1, organism="Enterococcus faecalis", phenotype="vre"),
        # data: the unit alone
        Signal("sampling-drop", "ED", "2025-07-01", "ED", 3, p=0.0),
        Signal("empty-run", "ED", "2025-07-05", "ED", 2, p=0.0),
        # zones: E1, E2, E3, E4 and a quarantined one are left out
        Signal("phenotype-excess", "URO|esbl", "2025-06-20", "URO", 4, phenotype="esbl", p=0.0),
        Signal("profile-excess", "ICU|S. aureus|z", "2026-03-10", "ICU", 4, organism="Staphylococcus aureus", p=0.0),
        Signal("empty-run", "PHC-S", "2025-12-09", "PHC-S", 1, p=0.0),
        Signal("rising-trend", "Escherichia coli|TMP|urine", "2026-01-04", None, 0.2, organism="Escherichia coli", antibiotic="TMP", p=0.0),
        Signal("sampling-drop", "MED-A", "2025-05-15", "MED-A", 1, p=0.0),
        # outside the scoring period
        Signal("profile-excess", "SURG|O|x", "2024-08-01", "SURG", 3, organism="O", p=0.0),
        # a trend signal that is not planted is hospital-wide, per series
        Signal("rising-trend", "Escherichia coli|CIP|all", "2026-02-01", None, 0.2, organism="Escherichia coli", antibiotic="CIP", p=0.0),
        Signal("rising-trend", "Klebsiella pneumoniae|CIP|all", "2026-02-01", None, 0.2, organism="Klebsiella pneumoniae", antibiotic="CIP", p=0.0),
    ]
    out = sd.episode_counts(det, sigs, 1.0)
    years = sd.score_years()
    assert years == pytest.approx(727 / 365.25)
    assert out["count"] == 2 + 1 + 1 + 1 + 2  # ICU|O twice, ICU|esbl, GER|vre, data ED, two hospital trend series
    assert out["episodes_per_year"] == pytest.approx(7 / years)
    assert out["cluster_count"] == 3 and out["sentinel_count"] == 1 and out["data_count"] == 1 and out["trend_count"] == 2
    assert out["divergence_count"] == 0
    only = sd.episode_counts(det, sigs, 1.0, ("cluster", "sentinel"))
    assert only["count"] == 4
    assert sd.zone_of(sigs[7], "cluster") == "E1" and sd.zone_of(sigs[8], "cluster") == "E2" and sd.zone_of(sigs[9], "data") == "E3"
    assert sd.zone_of(sigs[10], "trend") == "E4" and sd.zone_of(sigs[11], "data") == "Q-MED-A-gap"
    assert out["alerts_per_week"] == pytest.approx(out["alerts"] / (727 / 7))


def test_poisson_interval_is_the_exact_garwood_interval():
    from scipy import stats

    assert sd.poisson_interval(0) == pytest.approx([0.0, 3.688879454], abs=1e-9)
    assert sd.poisson_interval(1) == pytest.approx([0.025317808, 5.571643391], abs=1e-9)
    lo, hi = sd.poisson_interval(9)
    assert (round(lo, 3), round(hi, 3)) == (4.115, 17.085)  # the tabulated 95 % interval for 9 events
    # defining property: the bounds put 2.5 % in each tail
    assert stats.poisson.sf(8, lo) == pytest.approx(0.025, abs=1e-9) and stats.poisson.cdf(9, hi) == pytest.approx(0.025, abs=1e-9)
    # a rate per year over 727 days; a wider level is wider
    years = 727 / 365.25
    assert sd.poisson_interval(9, years) == pytest.approx([lo / years, hi / years])
    assert sd.poisson_interval(5, 1.0, 0.99)[1] > sd.poisson_interval(5)[1] > sd.poisson_interval(5, 1.0, 0.90)[1]


def test_two_unit_signal_in_a_zone_is_excluded():
    s = Signal("profile-excess", "k", "2025-07-01", "ED+URO", 3, organism="Escherichia coli", p=0.0)
    assert sd.zone_of(s, "cluster") == "E1"
    assert sd.fixed_key(s, "cluster") == "ED+URO|Escherichia coli"


def test_causality_guard(dataset, live):
    records, cultures = dataset
    sd.check_causal(live, ["2024-06-30", "2025-06-30"], records, cultures)

    def peeks(recs, cults, focus):
        # a signal on the first day that appears only when the data reaches 2025: not causal
        return [Signal("sampling-drop", "ED", "2024-01-01", "ED", 1, p=0.0)] if recs[-1].sample_date >= "2025-01-01" else []

    bad = sd.Detector("peek", peeks, (1.0,))
    problems = sd.check_causal(bad, ["2024-06-30"], records, cultures, raise_on_error=False)
    assert problems and "cut 2024-06-30" in problems[0]
    with pytest.raises(AssertionError, match="not causal"):
        sd.check_causal(bad, ["2024-06-30"], records, cultures)


def test_score_detector_gives_the_spec_keys(dataset, live, full_signals):
    records, cultures = dataset
    m, iv, n, ex = sd.score_detector(live, families=("rare", "common_esbl", "two_unit"), ks=(0, 2, 4), trials_per_seed=6, full_signals=full_signals, verbose=False)
    assert set(m) == {"D1", "D2", "D2_delay", "D3", "D3_delay", "D4", "D5", "D6", "D7", "I1"}
    assert set(m["D1"]) == {"E1", "E2", "E3", "E1_corrected", "E2_corrected", "E4"}
    assert set(m["D2"]) == set(m["D2_delay"]) == {f"{f}_k{k}" for f in ("rare", "common_esbl", "two_unit") for k in (0, 2, 4)}
    assert set(m["D3"]) == set(m["D3_delay"]) == {"gap2", "gap3", "gap5", "gap7", "half7"}
    assert set(m["D4"]) == {"episodes_per_year", "cluster", "sentinel", "data", "trend", "divergence", "alerts_per_week"}
    assert set(m["D5"]) == {"level", "noise", "rare", "common_esbl", "rare_delay", "common_esbl_delay"}
    assert set(m["I1"]) == {"alerts", "incidents", "alerts_per_incident"}
    assert 0 <= m["D6"] <= 1 and 0 <= m["D7"] <= 1
    assert set(iv["D2"]) == set(m["D2"]) and set(iv["D3"]) == set(m["D3"])
    assert n["D2"]["rare_k4"] == 6 and n["D3"]["gap3"] == 6
    # D4 comes with the exact Poisson interval of its counts (episodes per year in total and by kind; not the alerts)
    years = sd.score_years()
    assert set(iv["D4"]) == {"episodes_per_year", "sentinel", "cluster", "trend", "divergence", "data"}
    for k, (lo, hi) in iv["D4"].items():
        assert [lo, hi] == sd.poisson_interval(n["D4"][k], years)
        assert lo <= m["D4"][k] <= hi and m["D4"][k] == pytest.approx(n["D4"][k] / years)
    assert set(ex) >= {"D5_curve", "D2_per_seed", "D3_control", "operating_level", "cpu_by_part"}
    assert [r["level"] for r in ex["D5_curve"]] == list(live.levels) and ex["operating_level"] == 1.0
    assert all(len(v) == 1 for v in ex["D2_per_seed"].values())
    assert m["D1"]["E1"] == 0 and m["D1"]["E2"] == 0 and m["D1"]["E3"] == 0 and m["D1"]["E1_corrected"] == 5 and m["D1"]["E4"] == "2026-05-10"
    # a sentinel is not a cluster signal: the rare cell read over cluster signals alone can only be lower or equal
    assert all(ex["D2_cluster_signals_only"][k] <= m["D2"][k] for k in m["D2"])
    # a family not run leaves its keys out, and the cells that are run are the same
    m2, _, _, _ = sd.score_detector(live, families=("two_unit",), ks=(0, 2, 4), trials_per_seed=6, full_signals=full_signals, parts=("D2",), verbose=False)
    assert set(m2) == {"D2", "D2_delay"} and all(k.startswith("two_unit") for k in m2["D2"])
    assert {k: v for k, v in m["D2"].items() if k.startswith("two_unit")} == m2["D2"]


def test_confirm_uses_the_suffix_and_the_held_out_seeds(dataset, live, full_signals):
    m, iv, n, ex = sd.confirm(live, families=("rare",), ks=(0, 4), seeds=(2027, 2028), trials_per_seed=4, full_signals=full_signals, verbose=False)
    assert set(m) == {"D2_heldout", "D2_heldout_delay", "D3_heldout", "D3_heldout_delay", "D5_heldout"}
    assert set(m["D2_heldout"]) == {"rare_k0", "rare_k4"} and n["D2_heldout"]["rare_k4"] == 8
    assert ex["heldout_seeds"] == [2027, 2028] and set(iv) == {"D2_heldout", "D3_heldout", "D5_heldout"}
    assert sd.SEEDS_SCREEN == (2026,) and sd.SEEDS_HELDOUT == (2027, 2028, 2029, 2030)
    import inspect

    sig = inspect.signature(sd.score_detector)
    assert sig.parameters["seeds"].default == (2026,) and sig.parameters["trials_per_seed"].default == 200
    sig = inspect.signature(sd.confirm)
    assert sig.parameters["seeds"].default == (2027, 2028, 2029, 2030) and sig.parameters["trials_per_seed"].default == 50


def test_retune_picks_by_the_procedure(dataset):
    records, cultures = dataset
    live, table_ = sd.retune_live_set(records, cultures, trials=8, verbose=False)
    assert len(table_) == 12 and {r["detector"] for r in table_} == {"profile excess", "phenotype excess", "sampling drop", "empty run"}
    for name in {r["detector"] for r in table_}:
        rows = [r for r in table_ if r["detector"] == name]
        chosen = [r for r in rows if r["chosen"]]
        assert len(chosen) == 1 and sorted(r["alpha"] for r in rows) == [0.0001, 0.001, 0.01]
        ok = [r for r in rows if r["rate"] >= 0.8]
        if ok:
            assert chosen[0]["other_episodes"] == min(r["other_episodes"] for r in ok) and chosen[0] in ok
        else:
            assert chosen[0]["detected"] == max(r["detected"] for r in rows)
    assert (live.profile_alpha, live.phenotype_alpha, live.sampling_alpha, live.empty_alpha) == tuple(
        next(r["alpha"] for r in table_ if r["detector"] == n and r["chosen"]) for n in ("profile excess", "phenotype excess", "sampling drop", "empty run")
    )
    assert live.trend_alpha == 0.001 and live.new_in_unit_days == 180  # not tunable on year 1
    # the tuning saw nothing after the end of year 1
    assert harness.TUNE[1] == "2024-09-30"


def test_tune_curve_sees_only_the_tuning_year(dataset, live):
    records, cultures = dataset
    rows = sd.tune_curve(live, records, cultures, trials=6)
    assert [r["level"] for r in rows] == list(live.levels)
    assert all(r["rare_n"] == r["common_esbl_n"] == 6 for r in rows)
    rates = [r["rare"] for r in rows]
    assert rates == sorted(rates, reverse=True)  # a stricter level cannot detect more
    assert [r["noise_count"] for r in rows] == sorted((r["noise_count"] for r in rows), reverse=True)
    # noise is counted over 2024-04-01 to 2024-09-30 and scaled to a year
    assert rows[0]["noise_per_year"] == pytest.approx(rows[0]["noise_count"] / ((days_between("2024-04-01", "2024-09-30") + 1) / 365.25))

    # a detector that would fire on the scoring period only is silent in the tuning year, so it has no noise and detects nothing
    def late(recs, cults, focus):
        assert max(r.sample_date for r in recs) <= harness.TUNE[1]  # no scoring-period data is visible
        return []

    quiet = sd.Detector("quiet", late, (1.0,), kind_fn=lambda s: "cluster")
    out = sd.tune_curve(quiet, records, cultures, trials=3, families=("rare",))
    assert out == [{"level": 1.0, "noise_per_year": 0.0, "noise_count": 0, "rare": 0.0, "rare_hit": 0, "rare_n": 3, "rare_delay": None}]
    # the period option of the episode counts
    det = sd.Detector("s", lambda r, c, f: [], (1.0,), kind_fn=lambda s: sd.KIND_OF[s.detector])
    sig = Signal("profile-excess", "ICU|O|x", "2024-05-01", "ICU", 3, organism="O", p=0.0)
    assert sd.episode_counts(det, [sig], 1.0)["count"] == 0
    assert sd.episode_counts(det, [sig], 1.0, period=("2024-04-01", "2024-09-30"))["count"] == 1
