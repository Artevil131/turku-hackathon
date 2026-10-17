"""Experiment 0021: the naming step. Plan: README.md.

    uv run python experiments/0021-naming-step/run.py

Two feeds, the live set as shipped (level 1) and 0015's Gamma-Poisson test at its year-1 choice (S 26, g 0, L 1, no budget,
q < 0.005, `aei.gamma_poisson`), each with a detector whose `kind_of` is the naming rule of naming.py. The harness's blocks
(`aei.score_detection`: d1_scores, d3_block, d7_block, episode_counts, run_trials) give D1, D3, D4, D6, D7 and I1 once from one set of
trials (seed 2026, 200 per cell); the added measures (D7 first, D7 over all events, D7 per family, D6 annotated, the confusion of
rule against table, incidents per trial, slot coverage) read the same trials. I1 under the rules R1 to R7 is on the alerts
of the scoring period (incidents.py). Writes out/results.md, out/metrics.json, out/alerts.csv, out/figure.png.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import figure  # noqa: E402
import incidents as inc  # noqa: E402
import naming  # noqa: E402

from aei import gamma_poisson as gp  # noqa: E402
from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.coverage import wilson  # noqa: E402
from aei.dates import add_days  # noqa: E402
from aei.inject import FAMILIES, GAP_SETTINGS  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
EXPERIMENT = "0021-naming-step"
SEED = 2026
KS = sd.KS
CLUSTER_KS = (2, 3, 4, 6)
GAPS = [g for g in GAP_SETTINGS if g[0] >= 2]
CAUSAL_CUTS = ["2025-03-31", "2026-06-30"]
A_SCORE, B_SCORE = harness.SCORE


class NamedGP(gp.GammaPoisson):
    """0015's test with its signals named by the rule instead of 'always cluster'."""

    def kind_of(self, signal):
        return naming.kind_of_signal(signal)


def table_kind_live(s):
    return sd.default_kind_of(s)


def table_kind_gp(s):
    return "cluster"


def ci(k: int, n: int) -> list[float]:
    return list(wilson(k, n)) if n else [0.0, 1.0]


def pct(x, digits=1) -> str:
    return "n/a" if x is None else f"{100 * x:.{digits}f} %"


def md_table(header, rows) -> str:
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out) + "\n"


# ---------- the harness blocks, once ----------


def harness_metrics(det, signals, hits, op) -> tuple[dict, dict, dict, dict]:
    """D1, D3, D4, D6, D7, I1 as `score_detector` computes them (same blocks, same arithmetic), from trials already run."""
    m, iv, n, extra = {}, {}, {}, {}
    m["D1"] = sd.d1_scores(det, signals, op)
    rate, delay, ivs, nn, d6 = sd.d3_block(det, hits, op)
    for d in (rate, delay, ivs, nn):
        d.pop("gap0", None)
    m["D3"], m["D3_delay"], iv["D3"], n["D3"] = rate, delay, ivs, nn
    m["D6"], iv["D6"], n["D6"] = d6["share"], ci(d6["hit"], d6["n"]), d6["n"]
    d7 = sd.d7_block(det, hits, FAMILIES, KS, signals, op)
    m["D7"], n["D7"], iv["D7"], extra["D7_detail"] = d7["share"], d7["n"], ci(d7["right"], d7["n"]), d7["detail"]
    extra["D7_right"] = d7["right"]
    d4 = sd.episode_counts(det, signals, op)
    m["D4"] = {k: d4[k] for k in ("episodes_per_year", *sd.KINDS, "alerts_per_week")}
    n["D4"] = {"episodes_per_year": d4["count"], **{k: d4[f"{k}_count"] for k in sd.KINDS}, "alerts_per_week": d4["alerts"]}
    iv["D4"] = {k: sd.poisson_interval(c, sd.score_years()) for k, c in n["D4"].items() if k != "alerts_per_week"}
    return m, iv, n, extra


# ---------- the added measures, from the same trials ----------


def pool(hits, family, ks):
    return [t for k in ks for t in hits[SEED].get(family, {}).get(k, [])]


def gap_trials(hits):
    return {g: hits[SEED]["gaps"].get(g, []) for g in GAPS}


def first_kinds(signals, accept, det, kinds) -> bool | None:
    """Whether some accepted signal on the earliest date has one of `kinds` (None: no accepted signal)."""
    acc = [s for s in signals if accept(s)]
    if not acc:
        return None
    d0 = min(s.date for s in acc)
    return any(det.kind_of(s) in kinds for s in acc if s.date == d0)


def d7_extras(det, hits, signals, op) -> dict:
    accept = sd.accept_fn(det, op)
    named = sd.accept_fn(det, op, ("cluster",))
    data = sd.accept_fn(det, op, ("data",))
    fam = {}
    tot = {"events": 0, "detected": 0, "right": 0, "first_right": 0}
    for f in FAMILIES:
        ts = pool(hits, f, CLUSTER_KS)
        det_n = sum(t.detected(accept) for t in ts)
        right = sum(t.detected(accept) and t.detected(named) for t in ts)
        first = sum(first_kinds(t.signals, accept, det, ("cluster",)) is True for t in ts)
        fam[f] = {"events": len(ts), "detected": det_n, "right": right, "first_right": first}
    gaps = {"events": 0, "detected": 0, "right": 0, "first_right": 0}
    for g, ts in gap_trials(hits).items():
        gaps["events"] += len(ts)
        gaps["detected"] += sum(t.detected(data) for t in ts)
        gaps["right"] += sum(t.detected(data) for t in ts)
        gaps["first_right"] += sum(first_kinds(t.signals, accept, det, ("data",)) is True for t in ts)
    fam["gaps"] = gaps
    for v in fam.values():
        for k in tot:
            tot[k] += v[k]
    sigs = [s for s in signals if det.passes(s, op)]
    planted = {}
    for ev in sd.PLANTED:
        if ev.id.endswith("_corrected"):
            continue
        match = [s for s in sigs if sd._planted_hit(ev, s, det.kind_of(s))]
        kinds = sorted({det.kind_of(s) for s in match})
        planted[ev.id] = {
            "found": bool(match),
            "kinds_seen": kinds,
            "expected": list(ev.kinds),
            "right": bool(match) and all(k in kinds for k in ev.kinds),
            "first_date": min((s.date for s in match), default=None),
            "first_right": first_kinds(match, lambda s: True, det, ev.kinds),
        }
    for v in planted.values():
        tot["events"] += 1
        tot["detected"] += v["found"]
        tot["right"] += v["right"]
        tot["first_right"] += v["first_right"] is True
    return {"by_family": fam, "planted": planted, "total": tot}


def d6_annotated(det, hits, op) -> dict:
    """Gaps with a non-data signal in the gap or the 7 days after (the harness's D6) and, of those, the gaps with one that no
    data signal for the unit, dated up to 14 days before it and not after it, explains (what the feed would not annotate)."""
    data = sd.accept_fn(det, op, ("data",))
    non = sd.accept_fn(det, op, tuple(k for k in sd.KINDS if k != "data"))
    n = raw = unannotated = 0
    for ts in gap_trials(hits).values():
        for t in ts:
            n += 1
            end = add_days(t.start, t.k - 1 + 7)
            non_sigs = [s for s in t.signals if non(s) and s.date <= end]
            data_dates = [s.date for s in t.signals if data(s)]
            if non_sigs:
                raw += 1
                if any(not any(d <= s.date and sd.days_between(d, s.date) <= 14 for d in data_dates) for s in non_sigs):
                    unannotated += 1
    return {"n": n, "raw": raw, "unannotated": unannotated, "raw_ci": ci(raw, n), "unannotated_ci": ci(unannotated, n)}


def confusion(signals, table_kind) -> dict:
    c = Counter((table_kind(s), naming.kind_of_signal(s)) for s in signals)
    return {f"{a} -> {b}": v for (a, b), v in sorted(c.items())}


def trial_signal_confusion(hits, table_kind) -> dict:
    sigs = []
    for fam, cells in hits[SEED].items():
        for ts in cells.values():
            for t in ts:
                sigs += t.signals
    return confusion(sigs, table_kind)


def trial_incidents(det, hits, op) -> dict:
    """Incidents per detected injected cluster trial under R1 to R5 (R6, R7 need the patients behind the alerts, and the injected
    rows are not kept): the mean and the share of trials with exactly one."""
    accept = sd.accept_fn(det, op)
    out: dict = {}
    for f in FAMILIES:
        rows = {r.key: [] for r in inc.RULES[:5]}
        n_alerts = []
        for t in pool(hits, f, CLUSTER_KS):
            sigs = [s for s in t.signals if accept(s)]
            if not sigs:
                continue
            alerts = inc.alerts_from(det, sigs)
            n_alerts.append(len(alerts))
            for r in inc.RULES[:5]:
                rows[r.key].append(len(set(inc.group(alerts, r).values())))
        out[f] = {"trials": len(n_alerts), "mean_alerts": sum(n_alerts) / len(n_alerts) if n_alerts else None,
                  **{k: {"mean": sum(v) / len(v) if v else None, "one": sum(1 for x in v if x == 1)} for k, v in rows.items()}}
    return out


# ---------- alerts and incidents of the scoring period ----------


def zone_of_alert(a: inc.A) -> str | None:
    for s in a.group:
        z = sd.zone_of(s, naming.kind_of_signal(s))
        if z:
            return z
    return None


def i1_table(alerts: list[inc.A], evidence: inc.Evidence, check_r1: bool = True) -> dict:
    """For each rule: the grouping over all alerts (all dates, as the harness), the stats over the alerts of the scoring period."""
    pat = {a.id: evidence.patients(a) for a in alerts}
    rows = {}
    for r in inc.RULES:
        part = inc.group(alerts, r, pat)
        score = [a for a in alerts if A_SCORE <= a.date <= B_SCORE]
        st = inc.incident_stats(score, part, zone_of_alert)
        st["incidents_ci"] = sd.poisson_interval(st["incidents"], 1.0)
        st["patient_links"] = sum(1 for a in score if pat[a.id])
        rows[r.key] = st
        if r.key == "R1" and check_r1:
            ref = sd.group_incidents([a.as_sd() for a in alerts])
            assert {x.id: x.incident for x in ref} == part, "R1 does not reproduce group_incidents"
    return rows


def causal_grouping(alerts: list[inc.A], evidence: inc.Evidence) -> int:
    """Alerts grouped alone up to a cut date get the incidents they have in the grouping of all alerts; returns the number of
    disagreements over cut dates and rules."""
    pat = {a.id: evidence.patients(a) for a in alerts}
    bad = 0
    for r in inc.RULES:
        full = inc.group(alerts, r, pat)
        for cut in CAUSAL_CUTS:
            part = inc.group([a for a in alerts if a.date <= cut], r, pat)
            bad += sum(1 for k, v in part.items() if full[k] != v)
    return bad


def slot_coverage(alerts: list[inc.A]) -> dict:
    score = [a for a in alerts if A_SCORE <= a.date <= B_SCORE]
    by_kind = defaultdict(lambda: [0, 0])
    miss = Counter()
    for a in score:
        by_kind[a.name.kind][0] += 1
        if a.name.missing:
            by_kind[a.name.kind][1] += 1
            for s in a.name.missing:
                miss[f"{a.name.kind}:{s}"] += 1
    complete = sum(1 for a in score if not a.name.missing)
    return {"alerts": len(score), "complete": complete, "by_kind": {k: {"alerts": v[0], "incomplete": v[1]} for k, v in sorted(by_kind.items())}, "missing_slots": dict(sorted(miss.items()))}


# ---------- main ----------


def feed_result(name, det, op, stress, table_kind, records, cultures, cpe, evidence, clock, parts) -> dict:
    R: dict = {"name": name, "op": op, "stress": stress}
    t0 = clock.cpu
    signals = det.run(records, cultures, None)
    R["signals"] = len(signals)
    hits = sd.run_trials(det, records, cultures, (SEED,), FAMILIES, KS, 200, tuple(GAP_SETTINGS))
    parts[f"{name}: full run and trials"] = clock.cpu - t0
    R["hits_n"] = {f: {k: len(v) for k, v in hits[SEED][f].items()} for f in FAMILIES}
    t1 = clock.cpu
    m, iv, n, extra = harness_metrics(det, signals, hits, op)
    R.update(m=m, iv=iv, n=n, extra=extra)
    R["d7x"] = d7_extras(det, hits, signals, op)
    R["d6a"] = d6_annotated(det, hits, op)
    R["conf_full"] = confusion(signals, table_kind)
    R["conf_trials"] = trial_signal_confusion(hits, table_kind)
    R["trial_inc"] = trial_incidents(det, hits, op)
    parts[f"{name}: added measures"] = clock.cpu - t1
    R["_signals"] = signals
    return R


def alerts_at(det, signals, level, with_cpe, cpe):
    sigs = [s for s in signals if det.passes(s, level)]
    al = inc.alerts_from(det, sigs)
    return al + cpe if with_cpe else al


def main() -> None:
    clock = harness.Clock()
    parts: dict[str, float] = {}
    records, cultures = harness.data()
    OUT.mkdir(exist_ok=True)
    live = sd.LiveSet()
    live.kind_fn = naming.kind_of_signal
    engine = gp.Engine(records)
    gpd = NamedGP(name="Gamma-Poisson surprise, S 26, g 0, L 1, q < 0.005 (0015)", S=26, g=0, L=1, budget=False, engine=engine, default_level=0.005)
    cpe = inc.cpe_from(records)
    evidence = inc.Evidence(records)

    feeds = {
        "live": feed_result("live set as shipped", live, 1.0, 10.0, table_kind_live, records, cultures, cpe, evidence, clock, parts),
        "gp": feed_result("Gamma-Poisson (0015)", gpd, 0.005, 0.05, table_kind_gp, records, cultures, cpe, evidence, clock, parts),
    }
    dets = {"live": live, "gp": gpd}

    # I1 under the rules: alerts of each feed and of both, at the operating and the stress level, with and without CPE finds
    t0 = clock.cpu
    i1: dict = {}
    for with_cpe in (False, True):
        for level_kind in ("op", "stress"):
            al = {}
            for k in ("live", "gp"):
                lv = feeds[k]["op"] if level_kind == "op" else feeds[k]["stress"]
                al[k] = alerts_at(dets[k], feeds[k]["_signals"], lv, False, cpe)
            al["both"] = al["live"] + al["gp"]
            for k, a in al.items():
                if with_cpe:
                    a = a + cpe
                i1[(k, level_kind, with_cpe)] = (a, i1_table(a, evidence, check_r1=True))
    parts["incident rules"] = clock.cpu - t0

    # checks: the committed I1 rows, causality
    base = {k: json.loads((BASELINES / f"live-set-shipped.json").read_text()) for k in ("live",)}
    live_base = base["live"]
    gp_base = json.loads((harness.ROOT / "experiments" / "0015-gamma-poisson-guard-band" / "out" / "metrics.json").read_text())
    checks = {}
    c = i1[("live", "op", False)][1]["R1"]
    checks["R1 live: alerts, incidents against committed"] = [(c["alerts"], c["incidents"]), (live_base["metrics"]["I1"]["alerts"], live_base["metrics"]["I1"]["incidents"])]
    c = i1[("gp", "op", False)][1]["R1"]
    checks["R1 gp: alerts, incidents against committed"] = [(c["alerts"], c["incidents"]), (gp_base["metrics"]["I1"]["alerts"], gp_base["metrics"]["I1"]["incidents"])]
    c = i1[("live", "op", True)][1]["R1"]
    checks["R1 live with CPE finds against I1_full_tool"] = [(c["alerts"], c["incidents"]), (live_base["I1_full_tool"]["alerts"], live_base["I1_full_tool"]["incidents"])]
    for key, (x, y) in checks.items():
        assert tuple(x) == tuple(y), f"{key}: {x} != {y}"
    t0 = clock.cpu
    causal = {
        "grouping_disagreements": {f"{k[0]}/{k[1]}/{'cpe' if k[2] else 'no cpe'}": causal_grouping(v[0], evidence) for k, v in i1.items() if k[0] != "both"},
        "detector_signals": {
            "live": sd.check_causal(live, CAUSAL_CUTS, records, cultures, raise_on_error=False),
            "gp": sd.check_causal(gpd, CAUSAL_CUTS, records, cultures, raise_on_error=False),
        },
    }
    parts["causality checks"] = clock.cpu - t0

    coverage = {k: slot_coverage(i1[(k, "op", True)][0]) for k in ("live", "gp")}

    # alerts.csv: every alert of the scoring period of the two feeds at the operating level (live with CPE finds)
    rows = []
    for k in ("live", "gp"):
        a_all, tab = i1[(k, "op", k == "live")]
        part = inc.group(a_all, inc.RULES[0], {a.id: evidence.patients(a) for a in a_all})
        for a in sorted(a_all, key=lambda a: (a.date, a.id)):
            if A_SCORE <= a.date <= B_SCORE:
                rows.append([k, a.date, a.ward or "", a.name.kind, a.name.rule, part[a.id], a.name.en, a.name.fi, ";".join(a.name.missing)])
    with (OUT / "alerts.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["feed", "date", "unit", "kind", "rule", "incident_R1", "sentence_en", "sentence_fi", "missing_slots"])
        w.writerows(rows)

    # the picture: the live feed's alerts of E2 (one incident), E1, E3, E4
    a_live, _ = i1[("live", "op", True)]
    pat = {a.id: evidence.patients(a) for a in a_live}
    part = inc.group(a_live, inc.RULES[0], pat)
    zoned = defaultdict(list)
    for a in sorted(a_live, key=lambda a: (a.date, a.id)):
        z = zone_of_alert(a)
        if z and A_SCORE <= a.date <= B_SCORE:
            zoned[z].append(a)
    pic_rows = []
    if zoned["E2"]:
        pic_rows.append(("Tapaus / Incident · Teho / ICU · MRSA · %d hälytystä / %d alerts · %s–%s" % (len(zoned["E2"]), len(zoned["E2"]), zoned["E2"][0].date, zoned["E2"][-1].date), zoned["E2"]))
    for z in ("E1", "E3", "E4"):
        if zoned[z]:
            pic_rows.append((None, zoned[z][:1]))
    fig_info = figure.draw(OUT / "figure.png", pic_rows)

    cpu, wall = clock.cpu, clock.wall
    for f in feeds.values():
        f.pop("_signals", None)
    write_outputs(feeds, i1, checks, causal, coverage, fig_info, parts, cpu, wall, live_base, gp_base)


def i1_row(tab, key):
    t = tab[key]
    a, i = t["alerts"], t["incidents"]
    lo, hi = t["incidents_ci"]
    ratio = f"{a / i:.2f}" if i else "n/a"
    return [key, a, f"{i} ({lo:.1f} to {hi:.1f})", ratio, t["patient_links"], t["zone_incidents"], t["mixed_incidents"], t["multi_unit_incidents"], t["longest_days"]]


def write_outputs(feeds, i1, checks, causal, coverage, fig_info, parts, cpu, wall, live_base, gp_base) -> None:
    L, G = feeds["live"], feeds["gp"]
    out = [f"# 0021 results\n\nCommand: `uv run python experiments/0021-naming-step/run.py`. Seed 2026, 200 trials per cell, screening only. "
           f"Every number computed by this run unless it says committed (baselines/, 0015).\n"]
    w = out.append

    w("## Feeds and operating levels\n")
    w(md_table(["feed", "signals (loosest level)", "operating level", "stress level"], [[f["name"], f["signals"], f["op"], f["stress"]] for f in (L, G)]))

    w("## Naming rule against the harness's table, every signal\n")
    for f in (L, G):
        w(f"**{f['name']}**, full run, signals at the loosest level (table kind -> rule kind: count): `{json.dumps(f['conf_full'])}`  \n"
          f"Over every signal of every injected trial: `{json.dumps(f['conf_trials'])}`\n")
    w("Cells with different kinds on both sides are disagreements, and `-> unnamed` cells are signals no rule names.\n")

    w("## D7, the harness's definition, read with the rule's names\n")
    rows = []
    committed = {"live": (live_base["metrics"]["D7"], live_base["n"]["D7"]), "gp": (gp_base["metrics"]["D7"], gp_base["n"]["D7"])}
    for key, f in (("live", L), ("gp", G)):
        lo, hi = f["iv"]["D7"]
        c = committed[key]
        rows.append([f["name"], pct(f["m"]["D7"], 2), f"{f['extra']['D7_right']} of {f['n']['D7']}", f"{pct(lo, 1)} to {pct(hi, 1)}", f"{pct(c[0], 2)} (n {c[1]})"])
    w(md_table(["feed", "D7 by rule", "right of detected", "Wilson 95 %", "committed D7 (table)"], rows))
    w("D7 first, D7 over all events, and by family (E1 to E4 are in the next table). 'detected' is as the harness counts it; 'right' is some matching signal with the event's kind; 'first right' is the earliest matching signal with it (gaps: the earliest signal of any kind for the unit is a data signal).\n")
    for f in (L, G):
        t, fam = f["d7x"]["total"], f["d7x"]["by_family"]
        rows = [[k, v["events"], v["detected"], v["right"], v["first_right"], pct(v["first_right"] / v["detected"] if v["detected"] else None), pct(v["right"] / v["events"])] for k, v in fam.items()]
        rows.append(["all events incl. E1 to E4", t["events"], t["detected"], t["right"], t["first_right"], pct(t["first_right"] / t["detected"], 2), pct(t["right"] / t["events"], 2)])
        w(f"**{f['name']}**\n")
        w(md_table(["event family", "events", "detected", "right", "first right", "first right of detected", "right of all events"], rows))
        lo, hi = ci(t["first_right"], t["detected"])
        w(f"D7 first, all detected: {pct(t['first_right'] / t['detected'], 2)} (Wilson {pct(lo)} to {pct(hi)}); D7 over all events {pct(t['right'] / t['events'], 2)} (a miss is not named right).\n")
        rows = [[k, v["found"], ", ".join(v["kinds_seen"]) or "-", ", ".join(v["expected"]), v["right"], v["first_date"] or "-", v["first_right"]] for k, v in f["d7x"]["planted"].items()]
        w(md_table(["planted", "found", "kinds seen", "expected", "right", "first matching signal", "first right"], rows))

    w("## D6, injected gaps\n")
    rows = []
    for key, f in (("live", L), ("gp", G)):
        a = f["d6a"]
        b = live_base["metrics"]["D6"] if key == "live" else gp_base["metrics"]["D6"]
        rows.append([f["name"], f"{a['raw']} of {a['n']} = {pct(a['raw'] / a['n'])} ({pct(a['raw_ci'][0])} to {pct(a['raw_ci'][1])})",
                     pct(f["m"]["D6"], 2), pct(b, 2), f"{a['unannotated']} of {a['n']} = {pct(a['unannotated'] / a['n'])} ({pct(a['unannotated_ci'][0])} to {pct(a['unannotated_ci'][1])})"])
    w(md_table(["feed", "D6 from the trials (any non-data signal)", "D6 through score_detection blocks", "committed D6", "D6 annotated (not preceded by a data signal within 14 d)"], rows))
    w("D3 (a data signal within 14 days of the start, per gap setting): " + "; ".join(f"{f['name']}: " + ", ".join(f"{k} {v:.3f}" for k, v in f["m"]["D3"].items()) for f in (L, G)) + ".\n")

    w("## I1 under the incident rules\n")
    w("Rules: " + "; ".join(f"{r.key} {r.text}" for r in inc.RULES) + ". Alerts over the scoring period; incidents with an exact Poisson 95 % interval; 'alerts with patients' is the number of alerts with at least one patient behind them; zones are E1 to E4 and the quarantined ones, 'zone incidents' the number of incidents their alerts fall into (one per zone is right); 'mixed' incidents hold a zone and outside alerts or two zones; 'multi-unit' over more than one unit; longest in days. The harness's I1 is the no-CPE rows at the operating level.\n")
    names = {"live": "live set as shipped", "gp": "Gamma-Poisson (0015)", "both": "live set and Gamma-Poisson together"}
    for with_cpe in (False, True):
        for level_kind in ("op", "stress"):
            for k in ("live", "gp", "both"):
                a, tab = i1[(k, level_kind, with_cpe)]
                n_sc = sum(1 for x in a if A_SCORE <= x.date <= B_SCORE)
                lv = "operating" if level_kind == "op" else "stress"
                w(f"**{names[k]}, {lv} level, {'with' if with_cpe else 'without'} CPE finds** ({n_sc} alerts)\n")
                w(md_table(["rule", "alerts", "incidents (95 %)", "alerts per incident", "alerts with patients", "zone incidents", "mixed", "multi-unit", "longest d"], [i1_row(tab, r.key) for r in inc.RULES]))

    w("## Incidents per detected injected cluster trial\n")
    for f in (L, G):
        rows = []
        for fam, v in f["trial_inc"].items():
            rows.append([fam, v["trials"], "n/a" if v["mean_alerts"] is None else f"{v['mean_alerts']:.2f}"] + ["n/a" if v[r.key]["mean"] is None else f"{v[r.key]['mean']:.2f} ({v[r.key]['one']})" for r in inc.RULES[:5]])
        w(f"**{f['name']}**: mean incidents per trial (trials with exactly one), k 2 to 6 pooled; R6 and R7 need patients, not kept for injected rows.\n")
        w(md_table(["family", "detected trials", "mean alerts", *[r.key for r in inc.RULES[:5]]], rows))

    w("## Slot coverage of the sentences (alerts of the scoring period, with CPE finds for the live set)\n")
    for k, c in coverage.items():
        w(f"**{names[k]}**: {c['complete']} of {c['alerts']} alerts have every slot filled by a field or a setting. By kind: `{json.dumps(c['by_kind'])}`. Missing slots: `{json.dumps(c['missing_slots'])}`.\n")

    w("## Checks\n")
    w("R1 against the committed I1 rows (alerts, incidents): " + "; ".join(f"{k}: {v[0]} against {v[1]}" for k, v in checks.items()) + ". R1 equals `group_incidents` partition on every feed table above (asserted).\n")
    w(f"Incident grouping causal (alerts grouped alone up to a cut date get their final incident; cuts {CAUSAL_CUTS}, rules R1 to R7, disagreements): `{json.dumps(causal['grouping_disagreements'])}`.\n")
    w(f"`check_causal` on the detectors (cuts {CAUSAL_CUTS}): live {causal['detector_signals']['live'] or 'causal'}; Gamma-Poisson {causal['detector_signals']['gp'] or 'causal'}.\n")
    w(f"Picture rows printed (`out/figure.png`): `{json.dumps(fig_info['rows'])}`.\n")

    w("## Run time\n")
    for k, v in parts.items():
        w(f"- {k}: Run time {v:.1f} s")
    w(f"\nTotal: Run time {cpu:.1f} s CPU, Run time {wall:.1f} s wall (budget 600 s CPU).\n")
    (OUT / "results.md").write_text("\n".join(out))

    # metrics.json: D7, I1, D6 of the live set as shipped through the harness blocks; the rest in separate fields
    i1_live = i1[("live", "op", False)][1]["R1"]
    metrics = {"D7": L["m"]["D7"], "D6": L["m"]["D6"], "I1": {"alerts": i1_live["alerts"], "incidents": i1_live["incidents"], "alerts_per_incident": i1_live["alerts"] / i1_live["incidents"]}}
    intervals = {"D7": L["iv"]["D7"], "D6": L["iv"]["D6"], "I1": {"incidents": i1_live["incidents_ci"]}}
    n = {"D7": L["n"]["D7"], "D6": L["n"]["D6"], "I1": {"alerts": i1_live["alerts"], "incidents": i1_live["incidents"]}}

    def feed_json(f, key):
        t = f["d7x"]["total"]
        return {
            "feed": f["name"], "operating_level": f["op"], "stress_level": f["stress"],
            "D7": f["m"]["D7"], "D7_interval": f["iv"]["D7"], "D7_n": f["n"]["D7"],
            "D7_first": t["first_right"] / t["detected"], "D7_first_interval": ci(t["first_right"], t["detected"]), "D7_all_events": t["right"] / t["events"],
            "D7_by_family": f["d7x"]["by_family"], "D7_planted": f["d7x"]["planted"], "D6": f["m"]["D6"], "D6_interval": f["iv"]["D6"],
            "D6_annotated": f["d6a"]["unannotated"] / f["d6a"]["n"], "D6_annotated_interval": f["d6a"]["unannotated_ci"], "D6_n": f["d6a"]["n"],
            "D1": f["m"]["D1"], "D3": f["m"]["D3"], "D4": f["m"]["D4"],
            "confusion_full_run": f["conf_full"], "confusion_trial_signals": f["conf_trials"], "incidents_per_trial": f["trial_inc"],
            "slot_coverage": coverage[key],
            "I1_rules": {f"{lv}/{'cpe' if cpe_ else 'no cpe'}": {r: {k: v for k, v in t_.items()} for r, t_ in i1[(key, lv, cpe_)][1].items()} for lv in ("op", "stress") for cpe_ in (False, True)},
        }

    extra = {
        "by_feed": {"live_set_as_shipped": feed_json(L, "live"), "gamma_poisson_0015": feed_json(G, "gp"),
                    "both_feeds_I1_rules": {f"{lv}/{'cpe' if cpe_ else 'no cpe'}": i1[("both", lv, cpe_)][1] for lv in ("op", "stress") for cpe_ in (False, True)}},
        "checks": {"R1_reproduces": {k: [list(v[0]), list(v[1])] for k, v in checks.items()}, "causal": causal},
        "committed_rows": {"live_D7": live_base["metrics"]["D7"], "live_I1": live_base["metrics"]["I1"], "gp_D7": gp_base["metrics"]["D7"], "gp_I1": gp_base["metrics"]["I1"]},
        "rules": {r.key: r.text for r in inc.RULES},
        "figure_rows": fig_info["rows"],
    }
    harness.write_metrics(
        OUT / "metrics.json", experiment=EXPERIMENT,
        method="Naming step: a decision list over alert fields gives the kind and the sentence; D7 and D6 on planted and injected events, I1 under incident rules R1 to R7",
        family="interpretation", metrics=metrics, intervals=intervals, n=n, runtime_s=wall, cpu_s=cpu, seeds=[SEED], tuned_on_test=True,
        tuned_on="none for the rules (written from ENGINE.md 3.6 before any number); the row is the live set as shipped, whose settings were chosen on the scoring period",
        notes="D7, D6 and I1 of the live set as shipped read with the rule's names (harness definitions, committed rows beside them in `committed_rows`); the Gamma-Poisson feed (0015's year-1 choice, tuned_on_test false) and every added measure are in by_feed.",
        **extra,
    )


if __name__ == "__main__":
    main()
