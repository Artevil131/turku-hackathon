import { describe, expect, it } from "vitest";
import { dayNumber } from "./geometry.ts";
import {
  type BandGeom,
  dayAtX,
  moveRange,
  parseRange,
  rangeText,
  rangeWeekCount,
  rangeX,
  snapRange,
  stretchRange,
  weekAtX,
  xAtDay,
} from "./useBandRange.ts";

// A window of ten weeks starting Monday 2 Mar 2026; the clock stands on Wednesday 6 May (day 3 of week 10).
const d0 = dayNumber("2026-03-02");
const g: BandGeom = { gutter: 40, right: 740, d0, asOfDay: dayNumber("2026-05-06"), anchor: d0 };
// 66 days over 700 px.
const pxPerDay = 700 / 66;
const xOfIso = (iso: string) => g.gutter + (dayNumber(iso) - d0) * pxPerDay;

describe("x and days", () => {
  it("maps x to the day the band draws there and back", () => {
    expect(dayAtX(g, g.gutter)).toBe(d0);
    expect(dayAtX(g, g.right)).toBeCloseTo(g.asOfDay + 1);
    expect(xAtDay(g, dayAtX(g, 300))).toBeCloseTo(300);
  });
  it("clamps days outside the window to the plot", () => {
    expect(xAtDay(g, d0 - 30)).toBe(g.gutter);
    expect(xAtDay(g, g.asOfDay + 30)).toBe(g.right);
  });
});

describe("weekAtX", () => {
  it("gives the start of the week under the pointer", () => {
    expect(weekAtX(g, xOfIso("2026-03-02") + 1)).toBe(dayNumber("2026-03-02"));
    expect(weekAtX(g, xOfIso("2026-03-08") + 1)).toBe(dayNumber("2026-03-02"));
    expect(weekAtX(g, xOfIso("2026-03-09") + 1)).toBe(dayNumber("2026-03-09"));
  });
  it("holds to the first and last week past the plot's ends", () => {
    expect(weekAtX(g, 0)).toBe(d0);
    expect(weekAtX(g, 2000)).toBe(dayNumber("2026-05-04"));
  });
});

describe("snapRange", () => {
  it("runs from the first week's start to the last week's end, in either drag direction", () => {
    const a = dayNumber("2026-03-30");
    const b = dayNumber("2026-04-20");
    expect(snapRange(g, a, b)).toEqual({ from: "2026-03-30", to: "2026-04-26" });
    expect(snapRange(g, b, a)).toEqual({ from: "2026-03-30", to: "2026-04-26" });
    expect(rangeWeekCount(snapRange(g, a, b))).toBe(4);
  });
  it("caps the end at the clock's date", () => {
    expect(snapRange(g, dayNumber("2026-04-27"), dayNumber("2026-05-04"))).toEqual({ from: "2026-04-27", to: "2026-05-06" });
  });
});

describe("moving and stretching", () => {
  const r = { from: "2026-03-09", to: "2026-03-22" };
  it("moves by whole weeks and stops at the window's ends", () => {
    expect(moveRange(g, r, 1)).toEqual({ from: "2026-03-16", to: "2026-03-29" });
    expect(moveRange(g, r, -5)).toEqual({ from: "2026-03-02", to: "2026-03-15" });
    expect(moveRange(g, r, 20)).toEqual({ from: "2026-04-27", to: "2026-05-06" });
  });
  it("stretches the end by a week and never below one week", () => {
    expect(stretchRange(g, r, 1)).toEqual({ from: "2026-03-09", to: "2026-03-29" });
    expect(stretchRange(g, stretchRange(g, r, -1), -1)).toEqual({ from: "2026-03-09", to: "2026-03-15" });
  });
});

describe("a range outside the window", () => {
  it("is drawn clipped at the window's edge", () => {
    const r = { from: "2026-02-02", to: "2026-03-15" };
    const x = rangeX(g, r);
    expect(x.x0).toBe(g.gutter);
    expect(x.clipL).toBe(true);
    expect(x.clipR).toBe(false);
  });
});

describe("parseRange and rangeText", () => {
  it("takes both ends in order or nothing", () => {
    expect(parseRange("2026-04-02", "2026-04-30")).toEqual({ from: "2026-04-02", to: "2026-04-30" });
    expect(parseRange("2026-04-02", null)).toBeNull();
    expect(parseRange("2026-05-02", "2026-04-30")).toBeNull();
    expect(parseRange("april", "2026-04-30")).toBeNull();
  });
  it("names the dates in each language", () => {
    expect(rangeText("en", { from: "2026-04-02", to: "2026-04-30" })).toBe("2 Apr – 30 Apr");
    expect(rangeText("fi", { from: "2026-04-02", to: "2026-04-30" })).toBe("2.4. – 30.4.");
  });
});
