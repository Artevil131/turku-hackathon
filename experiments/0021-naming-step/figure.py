"""The picture of README.md ("Proposed visualisation"): the researcher's signal feed, drawn from real alerts of the live set (E2 as one
incident, E1, E3 and E4 beside it). Light background, 1,000 by 700 px, labels Finnish first; a slot no field fills prints "—".
PNG saved with metadata={"Software": None} so reruns compare equal."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

import naming
from incidents import A

INK, GREY, LIGHT, BAR = "#222222", "#6b6b6b", "#d9d9d9", "#4a4a4a"
BADGE = {"sentinel": ("◆", "Vartija / Sentinel"), "cluster": ("●", "Klusteri / Cluster"), "trend": ("▲", "Trendi / Trend"),
         "divergence": ("◐", "Poikkeama / Divergence"), "data": ("■", "Data / Data")}
BASELINE_DAYS = {"profile-excess": 365, "phenotype-excess": 365, "sampling-drop": 56, "empty-run": 56, "gamma-poisson": 182}  # detector settings


def _counts_line(a: A) -> str:
    s, k = a.signal, a.name.kind
    if a.source == "cpe" or s is None:
        return "CPE-löydös, ei testiä / CPE find, no test"
    if k == "sentinel":
        return f"ei aiempia {naming.LOOKBACK_DAYS.get(s.detector, 0)} pv / none in the previous {naming.LOOKBACK_DAYS.get(s.detector, 0)} d · sääntö, ei p-arvoa / rule, no p"
    base = BASELINE_DAYS.get(s.detector)
    b = "—" if base is None else f"{base}"
    if k == "cluster":
        e = f"{s.expected:.1f}"
        return f"{int(s.observed)} eristettä, tavallisesti {e.replace('.', ',')} / {int(s.observed)} isolates, usual {e} · vertailu {b} pv / baseline {b} d · p {s.p:.0e}"
    if k == "data":
        return f"{int(s.observed)}, tavallisesti {s.expected:.0f} / usual {s.expected:.0f} · vertailu {b} pv / baseline {b} d · p {s.p:.0e}"
    return f"viimeisin osuus {100 * s.observed:.0f} % / latest share {100 * s.observed:.0f} % · p {s.p:.0e}"


def _mark(ax, a: A, x: float, y: float) -> None:
    """One small mark per kind, right of the sentence: the count the sentence rests on."""
    s, k = a.signal, a.name.kind
    if k == "cluster" and s is not None:
        top = max(s.observed, s.expected, 1.0)
        for i, (v, name) in enumerate(((s.expected, "tav."), (s.observed, "hav."))):
            h = 46 * v / top
            ax.add_patch(Rectangle((x + 8 + i * 30, y + 50 - h), 22, h, fc=BAR if i else "white", ec=INK, lw=1, hatch="" if i else "///"))
            ax.text(x + 19 + i * 30, y + 62, name, ha="center", va="top", fontsize=7, color=GREY)
        ax.plot([x + 19, x + 19], [y + 50 - 46 * max(s.expected - 2 * s.expected ** 0.5, 0) / top, y + 50 - 46 * (s.expected + 2 * s.expected ** 0.5) / top], color=INK, lw=1)
    elif k == "data" and s is not None:
        top = max(s.observed, s.expected, 1.0)
        for i, v in enumerate((s.expected, s.observed)):
            h = 46 * v / top
            ax.add_patch(Rectangle((x + 8 + i * 30, y + 50 - h), 22, h, fc=BAR if i else "white", ec=INK, lw=1, hatch="" if i else "///"))
        ax.text(x + 38, y + 62, "tav. / hav.", ha="center", va="top", fontsize=7, color=GREY)
    elif k == "sentinel":
        ax.plot([x, x + 78], [y + 34, y + 34], color=GREY, lw=1)
        ax.plot([x + 78], [y + 34], marker="D", color=INK, ms=7)
        ax.text(x, y + 46, "180 pv / d", ha="left", va="top", fontsize=7, color=GREY)
    elif k == "trend" and s is not None:
        ax.text(x + 4, y + 20, "— → —", fontsize=9, color=GREY, va="center")
        ax.plot([x + 62], [y + 34 - 20 * s.observed], marker="o", color=INK, ms=6)


def draw(path: Path, rows: list[tuple[str | None, list[A]]]) -> dict:
    """`rows`: (incident header or None, alerts of the incident). Returns what is printed, for results.md."""
    fig = plt.figure(figsize=(10, 7), dpi=100, facecolor="white")
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_xlim(0, 1000)
    ax.set_ylim(700, 0)
    ax.axis("off")
    ax.text(24, 24, "Signaaliseuranta / Signal feed", fontsize=14, fontweight="bold", color=INK, va="center")
    ax.text(24, 46, "Esimerkki, synteettinen aineisto / example, synthetic data · kuvio ei ole päätös / sketch, not a decision", fontsize=8, color=GREY, va="center")
    y = 66.0
    printed = []
    for header, alerts in rows:
        if header:
            ax.plot([24, 976], [y, y], color=INK, lw=1.2)
            ax.text(24, y + 14, header, fontsize=9.5, fontweight="bold", color=INK, va="center")
            y += 28
        for a in alerts:
            indent = 24 + (22 if header else 0)
            sym, label = BADGE[a.name.kind]
            ax.text(indent, y + 12, f"{sym} {label}", fontsize=8.5, color=INK, va="center")
            ax.text(indent + 150, y + 12, a.name.fi, fontsize=10 if len(a.name.fi) < 70 else 8.6 if len(a.name.fi) < 80 else 7.6, fontweight="bold", color=INK, va="center")
            ax.text(indent + 150, y + 30, a.name.en, fontsize=9, color=INK, va="center")
            ax.text(976, y + 12, a.date, fontsize=8.5, color=GREY, ha="right", va="center")
            ax.text(indent + 150, y + 47, _counts_line(a), fontsize=7.5, color=GREY, va="center")
            fi, en = naming.FIRST_STEP[a.name.kind]
            miss = f"  ·  puuttuu / missing: {', '.join(a.name.missing)}" if a.name.missing else ""
            ax.text(indent + 150, y + 62, f"Ensimmäinen askel / First step: {fi} / {en}  ·  Näytä eristeet / Show isolates{miss}", fontsize=7.5, color=GREY, va="center")
            _mark(ax, a, 800, y - 6)
            ax.plot([indent, 976], [y + 74, y + 74], color=LIGHT, lw=0.8)
            printed.append({"date": a.date, "kind": a.name.kind, "en": a.name.en, "fi": a.name.fi, "missing": a.name.missing})
            y += 82
    fig.savefig(path, dpi=100, metadata={"Software": None})
    plt.close(fig)
    return {"rows": printed, "bottom_px": y}
