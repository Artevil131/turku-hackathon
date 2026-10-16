import { describe, expect, it } from "vitest";
import { fitLogistic, predict } from "./index.ts";

describe("fitLogistic", () => {
  it("recovers the group proportions of a single binary feature without penalty", () => {
    // Group 0: 2 of 10 events; group 1: 6 of 10.
    const x: number[][] = [];
    const y: (0 | 1)[] = [];
    for (let i = 0; i < 10; i++) {
      x.push([0]);
      y.push(i < 2 ? 1 : 0);
      x.push([1]);
      y.push(i < 6 ? 1 : 0);
    }
    const m = fitLogistic(x, y, { l2: 0 });
    expect(m.converged).toBe(true);
    expect(predict(m, [0])).toBeCloseTo(0.2, 6);
    expect(predict(m, [1])).toBeCloseTo(0.6, 6);
  });

  it("shrinks feature weights under a penalty but not the intercept", () => {
    const x = [[0], [0], [1], [1]];
    const y: (0 | 1)[] = [0, 0, 1, 1];
    const free = fitLogistic(x, y, { l2: 0.01 });
    const penalised = fitLogistic(x, y, { l2: 10 });
    expect(Math.abs(penalised.weights[1] as number)).toBeLessThan(Math.abs(free.weights[1] as number));
    expect(predict(penalised, [1])).toBeGreaterThan(predict(penalised, [0]));
  });

  it("handles no features", () => {
    const m = fitLogistic([[], [], [], []], [1, 1, 1, 0]);
    expect(predict(m, [])).toBeCloseTo(0.75, 6);
  });
});
