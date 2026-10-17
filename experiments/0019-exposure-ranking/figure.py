"""The sketch of the plan's "Proposed visualisation": the hospital network view for E1 as a horizontal bar list.

Eight rows, one per other unit, ordered by share from URO: a bar for the share (axis 0 to 0.2), the raw count as text
at its end, a grey band behind the bar from the 2.5th to the 97.5th percentile of the share under the rewirings, and at
the right edge the 8-week outcome as observed / expected, a filled marker when positive. Length carries the share,
text the count, the band the null, the fill the outcome; colour carries nothing.
"""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

INK, BAR, BAND, MUTED = "#222222", "#4a5560", "#d4d4d4", "#595959"


def draw(path, *, rows: list[dict], source_fi: str, source_en: str, n_null: int, onset: str, caption: str) -> None:
    """`rows`: one dict per unit in display order with unit_fi, unit_en, share, raw, lo, hi, observed, expected, positive."""
    n = len(rows)
    fig = plt.figure(figsize=(11.5, 5.9), dpi=120, facecolor="white")
    ax = fig.add_axes([0.21, 0.2, 0.5, 0.62], facecolor="white")
    ys = np.arange(n)[::-1]
    for y, r in zip(ys, rows):
        ax.barh(y, r["hi"] - r["lo"], left=r["lo"], height=0.74, color=BAND, zorder=1)
        ax.barh(y, r["share"], height=0.34, color=BAR, zorder=2)
        ax.text(max(r["share"], r["hi"]) + 0.004, y, f"{r['raw']:.1f} potilasta / patients", va="center", ha="left", fontsize=9, color=INK)
        ax.plot(1.07, y, marker="o", ms=9, mfc=INK if r["positive"] else "white", mec=INK, mew=1.4, clip_on=False, transform=ax.get_yaxis_transform())
        ax.text(1.115, y, f"{r['observed']} / {r['expected']:.1f}", va="center", ha="left", fontsize=9.5, color=INK, clip_on=False, transform=ax.get_yaxis_transform())
    ax.set_yticks(ys)
    ax.set_yticklabels([f"{r['unit_fi']}\n{r['unit_en']}" for r in rows], fontsize=9, color=INK, linespacing=1.15)
    ax.set_xlim(0, 0.2)
    ax.set_ylim(-0.6, n - 0.4)
    ax.set_xticks([0, 0.05, 0.10, 0.15, 0.20])
    ax.set_xlabel("osuus yksikön potilasvirrasta / share of the unit's inflow (0–1)", fontsize=9.5, color=INK)
    ax.tick_params(axis="x", labelsize=9, colors=INK)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.tick_params(axis="y", length=0)
    tr = ax.get_yaxis_transform()
    ax.text(1.04, n - 0.35, "tulos 8 vk / 8-week outcome", ha="left", va="bottom", fontsize=9, color=INK, clip_on=False, transform=tr)
    ax.text(1.04, n - 0.78, "havaittu / odotettu · observed / expected", ha="left", va="bottom", fontsize=8, color=MUTED, clip_on=False, transform=tr)
    fig.text(0.01, 0.945, f"ESBL · {source_fi} / {source_en} — mistä potilaat ovat tulleet / where patients came from, 12 kk / months", fontsize=11.5, color=INK, fontweight="bold", ha="left")
    fig.text(0.01, 0.905, f"tilanne / as of {onset} · vertailu: {n_null:,} satunnaistettua verkkoa / {n_null:,} rewired graphs".replace(",", " "), fontsize=9, color=MUTED, ha="left")
    handles = [
        plt.Rectangle((0, 0), 1, 1, color=BAR),
        plt.Rectangle((0, 0), 1, 1, color=BAND),
        plt.Line2D([], [], marker="o", ls="", mfc="white", mec=INK, ms=8),
        plt.Line2D([], [], marker="o", ls="", mfc=INK, mec=INK, ms=8),
    ]
    labels = [
        "osuus / share",
        "satunnaisverkkojen 95 % väli / 95 % band of rewired graphs",
        "ei ylitä vertailutasoa / not above baseline (α 0,05)",
        "ylittää vertailutason / above baseline (α 0,05)",
    ]
    fig.legend(handles, labels, loc="lower left", bbox_to_anchor=(0.08, 0.035), ncol=2, frameon=False, fontsize=8.5, labelcolor=INK)
    fig.text(0.01, 0.012, caption, fontsize=8, color=MUTED, ha="left")
    fig.savefig(path, format="png", dpi=120, facecolor="white", metadata={"Software": None})
    plt.close(fig)
