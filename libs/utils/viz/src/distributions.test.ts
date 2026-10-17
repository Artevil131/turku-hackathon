import { describe, expect, it } from "vitest";
import { ALPHA, betaDensity, betaGrid, logGamma, poissonPmf, poissonTailMass, surprise } from "./index.ts";

describe("viz helpers", () => {
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
    const c = betaGrid(88, 100, 2000);
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
  it("poissonTailMass is the detector's tail and the two tails overlap on k", () => {
    const upper = poissonTailMass("upper", 5, 0.608);
    const lower = poissonTailMass("lower", 4, 0.608);
    expect(upper + lower).toBeCloseTo(1, 12);
    expect(poissonTailMass("lower", 3, 2.5)).toBeCloseTo(0.7575761, 6);
  });
});
