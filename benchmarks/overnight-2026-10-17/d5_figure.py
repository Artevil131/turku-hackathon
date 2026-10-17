"""The morning report's detection figure: D5, sensitivity against noise, one panel per injection family, one line per
detection row (baselines and experiments), from the `D5_curve` field of every metrics.json.

    uv run python benchmarks/overnight-2026-10-17/d5_figure.py

Noise is D4 over the row's cluster and sentinel signals (harness-spec.md, Choices 3), episodes a year over the scoring
period; the rate is D2 at k = 4 on seed 2026 (200 trials per point). The dot on each line is the row's D5 headline (the
loosest level with noise at most 5 a year), labelled with its median delay in days.
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FAMILIES = [("rare", "Rare resistant clone"), ("common_esbl", "Common ESBL E. coli"), ("two_unit", "Split across two linked units")]
STYLES = ["-", "--", "-.", ":"]
MARKERS = ["o", "s", "^", "D", "v", "P", "X", "*"]


def rows() -> list[tuple[str, dict]]:
    paths = sorted(HERE.glob("baselines/live-set-*.json")) + sorted(ROOT.glob("experiments/*/out/metrics.json"))
    out = []
    for p in paths:
        m = json.loads(p.read_text())
        if m.get("family") != "detection" or not m.get("D5_curve"):
            continue
        name = p.stem if p.parent.name == "baselines" else p.parents[1].name
        out.append((name, m))
    return out


def main() -> None:
    data = rows()
    fig, axes = plt.subplots(1, len(FAMILIES), figsize=(13, 4.4), sharey=True)
    for ax, (fam, title) in zip(axes, FAMILIES, strict=True):
        for i, (name, m) in enumerate(data):
            curve = sorted((c for c in m["D5_curve"] if c.get(fam) is not None and c.get("noise", 0) > 0), key=lambda c: c["noise"])
            if not curve:
                continue
            x = [c["noise"] for c in curve]
            y = [c[fam] for c in curve]
            style = dict(color="black" if name.startswith("live-set") else f"C{i % 10}", linestyle=STYLES[i % len(STYLES)])
            ax.plot(x, y, marker=MARKERS[i % len(MARKERS)], markersize=3.5, linewidth=1.2, label=name, **style)
            head = [c for c in curve if c["noise"] <= 5.0]
            if head:
                h = max(head, key=lambda c: c["noise"])
                ax.plot([h["noise"]], [h[fam]], marker="o", markersize=8, markerfacecolor="white", color=style["color"])
                d = h.get(f"{fam}_delay")
                if d is not None:
                    ax.annotate(f"{d} d", (h["noise"], h[fam]), textcoords="offset points", xytext=(5, -10), fontsize=7)
        ax.axvline(5.0, color="grey", linewidth=0.8, linestyle=":")
        ax.text(5.1, 0.02, "5 a year", fontsize=7, color="grey")
        ax.set_xscale("log")
        ax.set_xlim(0.5, 200)
        ax.set_ylim(0, 1.02)
        ax.set_title(f"{title}, k = 4", fontsize=10)
        ax.set_xlabel("Noise: cluster and sentinel episodes a year (log)")
        ax.grid(True, linewidth=0.3, alpha=0.5)
    axes[0].set_ylabel("Share of injected clusters detected (200 trials)")
    axes[-1].legend(fontsize=7, loc="lower right", frameon=True)
    fig.suptitle("D5: detection against noise, seed 2026 (screening). Open dot: headline at most 5 a year, with median delay", fontsize=10)
    fig.tight_layout()
    fig.savefig(HERE / "d5-curves.png", dpi=110, metadata={"Software": None})
    print(f"{len(data)} rows -> {HERE / 'd5-curves.png'}")


if __name__ == "__main__":
    main()
