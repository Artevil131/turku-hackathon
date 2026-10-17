"""The sketch of README.md "Proposed visualisation": one expanded row of the doctor's list, ICU blood piperacillin-tazobactam,
severe basis, as of 2026-09-27, from the chosen setting. Area is probability: column width = expected organism share,
height = expected susceptibility, solid = covered, hatched = not covered; a bar on the right gives the coverage."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle
from scipy import stats

import mixture as mx
from aei import score_coverage as sc

AS_OF, WARD, SPECIMEN, DRUG = "2026-09-27", "ICU", "blood", "TZP"
BLUE, GREY, INK = "#2b6cb0", "#6b7280", "#1f2937"
MERGE_BELOW = 0.03
SHORT = {
    "Escherichia coli": "E. coli",
    "Klebsiella pneumoniae": "K. pneumoniae",
    "Klebsiella oxytoca": "K. oxytoca",
    "Citrobacter freundii": "C. freundii",
    "Proteus mirabilis": "P. mirabilis",
    "Pseudomonas aeruginosa": "P. aeruginosa",
    "Staphylococcus aureus": "S. aureus",
    "Staphylococcus saprophyticus": "S. saprophyticus",
    "Enterococcus faecalis": "E. faecalis",
}


def draw(path: Path, m_pi: float, m: float) -> dict:
    """Draw the sketch to `path` and return the numbers it shows."""
    view = sc.view_as_of(AS_OF)
    cid = sc.cell_id(WARD, SPECIMEN, DRUG)
    st = mx.stats(view, "left_out")
    r = mx.two_layer(st, m_pi, m)
    supp = r["supp"][cid]
    cols = []
    for o in np.nonzero(supp)[0]:
        masked = bool(mx.MASKCELL[cid, o])
        pb = float(r["pbar"][cid, o])
        iv = None if masked else tuple(stats.beta.ppf([0.05, 0.95], r["A"][cid, o], r["B"][cid, o]))
        cols.append(
            {"name": SHORT[mx.ORGS[o]], "w": float(r["pib"][cid, o]), "p": pb, "iv": iv, "masked": masked, "v": float(r["v"][cid, o]),
             "n_unit": int(st.n[cid, o]), "n_hosp": int(st.hn[cid, o])}
        )
    big = sorted([c for c in cols if c["w"] >= MERGE_BELOW], key=lambda c: -c["w"])
    small = [c for c in cols if c["w"] < MERGE_BELOW]
    if small:
        W = sum(c["w"] for c in small)
        pm = sum(c["w"] * c["p"] for c in small) / W
        sd = float(np.sqrt(sum((c["w"] / W) ** 2 * c["v"] for c in small)))
        big.append({"name": "muut / others", "w": W, "p": pm, "iv": (max(0.0, pm - 1.645 * sd), min(1.0, pm + 1.645 * sd)), "masked": False,
                    "n_unit": sum(c["n_unit"] for c in small), "n_hosp": sum(c["n_hosp"] for c in small), "merged": True})
    total = sum(c["w"] for c in big)

    mean = float(r["p"][cid])
    a, b = mx.match_beta(np.array([mean]), np.array([r["var"][cid]]))
    lo, hi = (float(x) for x in stats.beta.ppf([0.05, 0.95], a[0], b[0]))
    hosp = float(sc.hospital_365.predict(view, "left_out").set_index("cell_id").loc[cid, "p"])

    fig, (ax, bar) = plt.subplots(1, 2, figsize=(7.5, 4.0), gridspec_kw={"width_ratios": [4.0, 2.0]}, facecolor="white")
    x0 = 0.0
    for c in big:
        w = c["w"] / total * 100
        ph = 1.0 if c["masked"] else c["p"]
        if not c["masked"]:
            ax.add_patch(Rectangle((x0, 0), w, ph, facecolor=BLUE, edgecolor="white", linewidth=1.0))
        ax.add_patch(Rectangle((x0, 0 if c["masked"] else c["p"]), w, 1 - (0 if c["masked"] else c["p"]), facecolor="white", edgecolor=GREY, hatch="////", linewidth=0.0))
        ax.add_patch(Rectangle((x0, 0), w, 1.0, facecolor="none", edgecolor="white", linewidth=1.2))
        cx = x0 + w / 2
        if c["iv"] is not None:
            ax.vlines(cx, c["iv"][0], c["iv"][1], color=INK, linewidth=1.0)
            ax.hlines([c["iv"][0], c["iv"][1]], cx - 0.6, cx + 0.6, color=INK, linewidth=1.0)
        label = "luontainen / intrinsic" if c["masked"] else f"{c['name']} {c['w'] / total * 100:.0f} %"
        ax.text(cx, 1.015, label, ha="left", va="bottom", rotation=50, rotation_mode="anchor", fontsize=6.5, color=INK, style="italic" if "/" not in c["name"] else "normal")
        ax.text(cx, -0.03, f"n {c['n_unit']} / {c['n_hosp']}", ha="center", va="top", rotation=90, fontsize=6, color=INK)
        x0 += w
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 1)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xticklabels([])
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1.0])
    ax.set_yticklabels(["0", "25", "50", "75", "100"], fontsize=7)
    ax.set_ylabel("Herkkien osuus / Share susceptible, %", fontsize=7.5, color=INK)
    ax.text(50, -0.36, "Osuus isolaateista / Share of isolates, %", ha="center", va="top", fontsize=7.5, color=INK)
    ax.text(50, -0.44, "n yksikkö / sairaala, 365 vrk = n unit / hospital, 365 d", ha="center", va="top", fontsize=6.5, color=GREY)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.text(0.09, 0.965, "ICU, veri / blood, piperasilliini-tatsobaktaami / piperacillin-tazobactam, 2026-09-27", fontsize=8, color=INK, ha="left", va="top")

    bar.bar([0], [mean], width=0.6, color=BLUE, edgecolor="white")
    bar.bar([0], [1 - mean], bottom=[mean], width=0.6, facecolor="white", edgecolor=GREY, hatch="////", linewidth=0.0)
    bar.vlines(0, lo, hi, color=INK, linewidth=1.2)
    bar.hlines([lo, hi], -0.1, 0.1, color=INK, linewidth=1.2)
    bar.plot([-0.45, 0.35], [0.9, 0.9], color=INK, linestyle=":", linewidth=1.2)
    bar.annotate("raja / threshold\n90 %", xy=(0.35, 0.9), xytext=(0.5, 0.40), fontsize=6.5, color=INK, va="center", arrowprops={"arrowstyle": "-", "lw": 0.6, "color": INK})
    bar.plot([-0.45, 0.35], [hosp, hosp], color=INK, linestyle="--", linewidth=1.2)
    bar.annotate(f"sairaala 365 vrk /\nhospital 365 d: {hosp * 100:.0f} %", xy=(0.35, hosp), xytext=(0.5, 0.62), fontsize=6.5, color=INK, va="center", arrowprops={"arrowstyle": "-", "lw": 0.6, "color": INK})
    bar.text(0, 1.04, f"{mean * 100:.0f} % ({lo * 100:.0f}–{hi * 100:.0f})", ha="center", va="bottom", fontsize=7.5, color=INK)
    bar.set_xlim(-0.5, 1.9)
    bar.set_ylim(0, 1)
    bar.set_xticks([0])
    bar.set_xticklabels(["Kattavuus\nCoverage"], fontsize=7.5)
    bar.set_yticks([])
    for s in ("top", "right", "left"):
        bar.spines[s].set_visible(False)
    fig.subplots_adjust(left=0.09, right=0.99, top=0.66, bottom=0.30, wspace=0.05)
    fig.savefig(path, dpi=120, metadata={"Software": None})
    plt.close(fig)
    return {
        "cell": f"{WARD} {SPECIMEN} {DRUG}",
        "as_of": AS_OF,
        "coverage": mean,
        "interval90": [lo, hi],
        "hospital_365": hosp,
        "columns": [{k: (list(v) if isinstance(v, tuple) else v) for k, v in c.items() if k != "v"} for c in big],
    }
