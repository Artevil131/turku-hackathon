import { mkdirSync, writeFileSync } from "node:fs";
import { poissonLower, poissonUpper } from "@aei/detect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoverageShape } from "./CoverageShape.tsx";
import { poissonPlan } from "./mathHelpers.ts";
import { PoissonTail } from "./PoissonTail.tsx";
import { SurpriseScale } from "./SurpriseScale.tsx";
import { WeeklyWindow } from "./WeeklyWindow.tsx";

// Real alerts computed with buildAlerts over the synthetic dataset (same code as GET /api/alerts, from 2024-06-01).
const ALERTS = [
  { detector: "phenotype-excess", observed: 5, expected: 0.608130081300813, p: 0.0004191407926780127 },
  { detector: "profile-excess", observed: 3, expected: 0.02849002849002849, p: 0.000003772716952971142 },
  { detector: "phenotype-excess", observed: 3, expected: 0.1461864406779661, p: 0.0004667985378352183 },
  { detector: "phenotype-excess", observed: 3, expected: 0.18857142857142858, p: 0.0009708393486049062 },
  { detector: "phenotype-excess", observed: 2, expected: 0.042763157894736836, p: 0.0008886903043395835 },
  { detector: "empty-run", observed: 1, expected: 7.339285714285714, p: 0.0006495142940726429 },
  { detector: "empty-run", observed: 2, expected: 4.25, p: 0.00020346836901064417 },
  { detector: "sampling-drop", observed: 6, expected: 21.5, p: 0.00008567072297827546 },
  { detector: "sampling-drop", observed: 39, expected: 69.875, p: 0.000040917637918265346 },
];

describe("PoissonTail: shaded tail is the live detector's p", () => {
  for (const a of ALERTS) {
    it(`${a.detector} ${a.observed}/${a.expected}`, () => {
      const plan = poissonPlan(a.detector, a.observed, a.expected);
      expect(plan).not.toBeNull();
      const pl = plan as NonNullable<typeof plan>;
      if (pl.tail === "upper") expect(pl.shaded).toBeCloseTo(poissonUpper(a.observed, a.expected), 12);
      if (pl.tail === "lower") expect(pl.shaded).toBeCloseTo(poissonLower(a.observed, a.expected), 12);
      expect(Math.abs(pl.shaded - a.p)).toBeLessThan(1e-9);
      // the drawn bars add up to the shaded probability when the tail is fully inside the drawn range
      const drawn = pl.bars.filter((b) => b.shaded).reduce((s, b) => s + b.pmf, 0);
      expect(drawn).toBeLessThanOrEqual(pl.shaded + 1e-12);
    });
  }
  it("rising trend has no count", () => expect(poissonPlan("rising-trend", 0.2, 0.1)).toBeNull());
});

describe("render", () => {
  const weeks = Array.from({ length: 26 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 11, 17 + 7 * i)).toISOString().slice(0, 10);
    return { start: d, count: [0, 1, 0, 2, 1, 0, 0, 2, 0, 1][i % 10] as number };
  });
  weeks[25] = { start: weeks[25]?.start as string, count: 5 };
  it("renders every component in both locales and writes a snapshot", () => {
    const parts: string[] = [];
    for (const locale of ["en", "fi"] as const) {
      parts.push(`<h2>${locale}</h2><div class="g">`);
      for (const a of ALERTS.filter((_, i) => [0, 1, 5, 7, 8].includes(i))) {
        const html = renderToStaticMarkup(
          <div className="cell">
            <b>{a.detector}</b>
            <PoissonTail {...a} locale={locale} />
            <SurpriseScale p={a.p} detector={a.detector} locale={locale} />
          </div>,
        );
        expect(html).toContain('role="img"');
        parts.push(html);
      }
      for (const [c, k, bar] of [
        [88, 100, 0.8],
        [355, 355, 0.9],
        [3, 9, 0.9],
      ] as const) {
        const w = 1.959964;
        const pp = c / k;
        const d = 1 + (w * w) / k;
        const ctr = (pp + (w * w) / (2 * k)) / d;
        const half = (w * Math.sqrt((pp * (1 - pp)) / k + (w * w) / (4 * k * k))) / d;
        parts.push(
          `<div class="cell"><b>${c}/${k}</b>${renderToStaticMarkup(<CoverageShape covered={c} known={k} interval={[Math.max(0, ctr - half), Math.min(1, ctr + half)]} bar={bar} locale={locale} />)}</div>`,
        );
      }
      parts.push(
        `<div class="cell">${renderToStaticMarkup(<WeeklyWindow weeks={weeks} windowStart={weeks[25]?.start as string} observed={5} expected={0.608} p={0.00042} alertDate="2025-06-10" locale={locale} />)}</div>`,
      );
      parts.push("</div>");
    }
    const css = ["PoissonTail", "CoverageShape", "SurpriseScale", "WeeklyWindow"].map((n) => require_(n)).join("\n");
    mkdirSync("benchmarks/overnight-2026-10-17/design", { recursive: true });
    if (process.env.MATH_SNAPSHOT) {
      writeFileSync(
        process.env.MATH_SNAPSHOT,
        `<!doctype html><meta charset=utf-8><style>body{font:13px system-ui;margin:12px;--t-xs:12px;--t-s:13px}.g{display:flex;flex-wrap:wrap;gap:16px}.cell{width:${process.env.MATH_W ?? "340"}px;border:1px solid #e4e6ee;padding:12px}${css}</style>${parts.join("")}`,
      );
    }
  });
});

import { readFileSync } from "node:fs";

function require_(n: string) {
  return readFileSync(`apps/web/src/components/math/${n}.css`, "utf8");
}
