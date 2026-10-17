import { mkdirSync, writeFileSync } from "node:fs";
import { poissonLower, poissonUpper } from "@aei/detect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoverageShape } from "./CoverageShape.tsx";
import { ALPHA, betaCurve, betaDensity, logGamma, poissonPlan, poissonPmf, surprise, weeklyPatients } from "./mathHelpers.ts";
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

describe("math helpers", () => {
  it("logGamma matches factorials and Γ(1/2)", () => {
    expect(Math.exp(logGamma(6))).toBeCloseTo(120, 8);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(logGamma(101)).toBeCloseTo(363.73937555556347, 8);
  });
  it("pmf sums to 1", () => {
    let s = 0;
    for (let k = 0; k < 80; k++) s += poissonPmf(k, 12.5);
    expect(s).toBeCloseTo(1, 12);
  });
  it("beta density integrates to 1 and peaks at the share", () => {
    const c = betaCurve(88, 100, 2000);
    const area = c.reduce((s, q) => s + q.y, 0) / 2000;
    expect(area).toBeCloseTo(1, 2);
    const peak = c.reduce((m, q) => (q.y > m.y ? q : m));
    expect(peak.x).toBeCloseTo(0.88, 2);
    expect(betaDensity(0.5, 1, 1)).toBeCloseTo(1, 12);
    expect(betaDensity(0.3, 2, 3)).toBeCloseTo(12 * 0.3 * 0.49, 10); // 1/B(2,3) = 12
  });
  it("surprise and thresholds", () => {
    expect(surprise(1e-3)).toBeCloseTo(3, 12);
    expect(surprise(1e-9)).toBe(6);
    expect(ALPHA["profile-excess"]).toBe(1e-4);
    expect(ALPHA["phenotype-excess"]).toBe(1e-3);
  });
});

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

describe("weeklyPatients", () => {
  const rec = (patientId: string, sampleDate: string, ward = "URO", phenotypes = ["esbl"]) =>
    ({ patientId, sampleDate, ward, phenotypes }) as never;
  it("counts distinct patients per week, ward and phenotype", () => {
    const w = weeklyPatients(
      [
        rec("a", "2025-06-02"),
        rec("a", "2025-06-05"),
        rec("b", "2025-06-08"),
        rec("c", "2025-06-09"),
        rec("d", "2025-06-09", "ICU"),
        rec("e", "2025-06-09", "URO", ["mrsa"]),
        rec("f", "2025-06-16"),
      ],
      "URO",
      "esbl",
      "2025-06-02",
      "2025-06-15",
    );
    expect(w).toEqual([
      { start: "2025-06-02", count: 2 },
      { start: "2025-06-09", count: 1 },
    ]);
  });
  it("drops a partial last week and leaves empty weeks at 0", () => {
    const w = weeklyPatients([], "URO", "esbl", "2025-06-01", "2025-06-24");
    expect(w.map((x) => x.start)).toEqual(["2025-06-01", "2025-06-08", "2025-06-15"]);
    expect(w.every((x) => x.count === 0)).toBe(true);
  });
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
