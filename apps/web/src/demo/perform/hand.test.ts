import { describe, expect, it } from "vitest";
import { arcPoint, type Orbit, orbitPoint } from "./hand.ts";

// The hand's paths are pure geometry: a travel bows away from the straight line, overshoots a little and settles; a
// scan leaves the resting point, loops around the object the asked number of times and comes back to the same point.

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("a travel", () => {
  const from = { x: 100, y: 100 };
  const to = { x: 700, y: 400 };
  it("starts and ends on its points", () => {
    expect(dist(arcPoint(from, to, 0, 0.1), from)).toBeLessThan(0.01);
    expect(dist(arcPoint(from, to, 1, 0.1), to)).toBeLessThan(0.01);
  });
  it("bows away from the straight line by the asked share of the distance, to the asked side", () => {
    const chord = dist(from, to);
    const offLine = (p: { x: number; y: number }) => ((to.x - from.x) * (p.y - from.y) - (to.y - from.y) * (p.x - from.x)) / chord;
    const mid = offLine(arcPoint(from, to, 0.5, 0.1));
    expect(Math.abs(mid)).toBeGreaterThan(chord * 0.09);
    expect(Math.abs(mid)).toBeLessThan(chord * 0.11);
    expect(Math.sign(offLine(arcPoint(from, to, 0.5, -0.1)))).toBe(-Math.sign(mid));
  });
  it("overshoots the target near the end and settles back", () => {
    const along = (p: { x: number; y: number }) => ((p.x - from.x) * (to.x - from.x) + (p.y - from.y) * (to.y - from.y)) / dist(from, to);
    const chord = dist(from, to);
    const peak = Math.max(...[0.8, 0.85, 0.9].map((p) => along(arcPoint(from, to, p, 0))));
    expect(peak).toBeGreaterThan(chord + 1);
    expect(peak).toBeLessThan(chord + 6);
  });
  it("eases: slow at both ends, fast in the middle", () => {
    const step = (p: number) => dist(arcPoint(from, to, p, 0.1), arcPoint(from, to, p + 0.05, 0.1));
    expect(step(0)).toBeLessThan(step(0.475) / 3);
    expect(step(0.95)).toBeLessThan(step(0.475));
  });
});

describe("a scan", () => {
  const o: Orbit = { rest: { x: 300, y: 220 }, centre: { x: 340, y: 200 }, rx: 90, ry: 40, turns: 2, dir: 1 };
  it("leaves the resting point and returns to it", () => {
    expect(dist(orbitPoint(o, 0), o.rest)).toBeLessThan(0.01);
    expect(dist(orbitPoint(o, 1), o.rest)).toBeLessThan(0.01);
  });
  it("goes round the centre the asked number of times", () => {
    let turned = 0;
    let last = Number.NaN;
    for (let i = 0; i <= 2000; i++) {
      const p = orbitPoint(o, i / 2000);
      const a = Math.atan2(p.y - o.centre.y, p.x - o.centre.x);
      if (!Number.isNaN(last)) {
        let d = a - last;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        turned += d;
      }
      last = a;
    }
    expect(turned / (2 * Math.PI)).toBeCloseTo(2, 1);
  });
  it("reaches the loop's full width in the middle and never jumps", () => {
    const widths = [0.3, 0.5, 0.7].map((p) => orbitPoint(o, p));
    expect(Math.max(...widths.map((p) => Math.abs(p.x - o.centre.x)))).toBeGreaterThan(o.rx * 0.6);
    let maxStep = 0;
    for (let i = 0; i < 1000; i++) maxStep = Math.max(maxStep, dist(orbitPoint(o, i / 1000), orbitPoint(o, (i + 1) / 1000)));
    expect(maxStep).toBeLessThan(4);
  });
  it("turns the other way when asked", () => {
    const a = (p: { x: number; y: number }) => Math.atan2(p.y - o.centre.y, p.x - o.centre.x);
    const cw = a(orbitPoint(o, 0.3)) - a(orbitPoint(o, 0.28));
    const ccw = a(orbitPoint({ ...o, dir: -1 }, 0.3)) - a(orbitPoint({ ...o, dir: -1 }, 0.28));
    expect(Math.sign(cw)).toBe(-Math.sign(ccw));
  });
});
