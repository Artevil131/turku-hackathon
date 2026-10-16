import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe as group, expect, it } from "vitest";
import type { Signal } from "../../engine/types.ts";
import type { FeedMeta, Result } from "../../feed/types.ts";
import { describe } from "./describe.tsx";
import { DEFAULT_FILTERS, isActive, passes, reveal, sortAlerts, unseenActive, unseenEpisodes } from "./filters.ts";
import { AlertsScreen } from "./index.tsx";
import { Body, patientTag } from "./parts.tsx";

// Made-up codes on purpose: the screen must work with any feed.
const meta: FeedMeta = {
  start: "2024-01-01",
  end: "2025-12-31",
  units: [
    { code: "W1", en: "Ward One", fi: "Osasto Yksi", type: "in", institution: "hospital" },
    { code: "C9", en: "Clinic Nine", fi: "Klinikka Yhdeksän", type: "out", institution: "primary_care" },
  ],
  antibiotics: [
    { code: "ZZ", en: "zetamycin", fi: "zetamysiini", class: "x", reportedFor: "all" },
    { code: "AA", en: "alphacillin", fi: "alfasilliini", class: "y", reportedFor: "all" },
    { code: "SC", en: "betoxin (screen)", fi: "betoksiini (seulonta)", class: "resistance screen", reportedFor: "all" },
  ],
  organisms: ["Genus species"],
  specimens: [{ code: "s1", en: "fluid", fi: "neste" }],
  ai: false,
};
const asOf = "2025-06-30";

const sig = (over: Partial<Signal> & Pick<Signal, "id" | "kind" | "severity">): Signal => ({
  isolateIds: [],
  observed: 0,
  firstDate: "2025-06-20",
  lastDate: "2025-06-30",
  ward: "W1",
  ...over,
});

const cluster = sig({
  id: "cluster|W1",
  kind: "cluster",
  severity: "high",
  organism: "Genus species",
  specimen: "s1",
  phenotype: "abc",
  resists: ["AA", "ZZ"],
  observed: 6,
  expected: 0.4,
  p: 1e-7,
  patients: 6,
  isolateIds: ["i1", "i2"],
});
const shiftFew = sig({
  id: "shift|W1",
  kind: "shift",
  severity: "medium",
  organism: "Genus species",
  specimen: "s1",
  antibiotic: "ZZ",
  observed: 55.6,
  expected: 4,
  p: 0.0002,
  recent: { works: 4, n: 9 },
  baseline: { works: 48, n: 50 },
  isolateIds: ["i1"],
});
const trend = sig({
  id: "trend|x",
  kind: "trend",
  severity: "medium",
  ward: null,
  firstDate: "2025-03-01",
  organism: "Genus species",
  specimen: "s1",
  antibiotic: "AA",
  observed: 20,
  expected: 17,
  p: 0.00005,
  recent: { works: 800, n: 1000 },
  baseline: { works: 830, n: 1000 },
  series: [
    { period: "2025-01-01", share: { works: 85, n: 100 } },
    { period: "2025-04-01", share: { works: 78, n: 100 } },
  ],
});
const gap = sig({ id: "gap|C9", kind: "data-gap", severity: "medium", ward: "C9", observed: 0, expected: 29.9, p: 1e-13 });
const sentinel = sig({
  id: "sentinel|W1",
  kind: "sentinel",
  severity: "high",
  phenotype: "qrx",
  organism: "Genus species",
  specimen: "s1",
  observed: 1,
  patients: 1,
  firstDate: "2025-06-29",
  lastDate: "2025-06-29",
  isolateIds: ["i1"],
});
const old = sig({ id: "old", kind: "surge", severity: "high", firstDate: "2025-01-01", lastDate: "2025-01-10", phenotype: "abc", observed: 4, expected: 1.2 });
const low = sig({ id: "low", kind: "shift", severity: "low" });

const result = (over: Partial<Result>): Result => ({
  isolateId: "i1",
  cultureId: "c1",
  patientId: "PX0012345",
  sampleDate: "2025-06-25",
  admissionDate: "2025-06-21",
  ward: "W1",
  specimen: "s1",
  organism: "Genus species",
  sex: "F",
  ageYears: 81,
  phenotypes: [],
  results: {},
  ...over,
});

group("alert filters", () => {
  it("counts an alert as active while it signalled in the last 4 weeks", () => {
    expect(isActive(cluster, asOf)).toBe(true);
    expect(isActive(old, asOf)).toBe(false);
    expect(isActive({ ...old, lastDate: "2025-06-03" }, asOf)).toBe(true);
    expect(isActive({ ...old, lastDate: "2025-06-02" }, asOf)).toBe(false);
  });
  it("defaults to active high and medium alerts on every unit", () => {
    const all = [cluster, shiftFew, trend, gap, sentinel, old, low];
    const shown = all.filter((s) => passes(s, DEFAULT_FILTERS, asOf)).map((s) => s.id);
    expect(shown).toEqual(["cluster|W1", "shift|W1", "trend|x", "gap|C9", "sentinel|W1"]);
    expect(all.filter((s) => passes(s, { ...DEFAULT_FILTERS, unit: "C9" }, asOf)).map((s) => s.id)).toEqual(["gap|C9"]);
  });
  it("lists active first, then the most severe, then the newest episode", () => {
    const order = sortAlerts([old, trend, gap, cluster, sentinel, shiftFew], asOf).map((s) => s.id);
    expect(order).toEqual(["sentinel|W1", "cluster|W1", "gap|C9", "shift|W1", "trend|x", "old"]);
  });
  it("widens the filters just enough to show an alert opened from elsewhere", () => {
    const f = reveal({ period: "active", severities: ["high"], kind: "cluster", unit: "C9" }, old, asOf);
    expect(f).toEqual({ period: "all", severities: ["high"], kind: null, unit: null });
  });
  it("badges only unseen, active, high and medium alerts", () => {
    expect(unseenActive([cluster, old, low, gap], asOf, new Set(["gap|C9"])).map((s) => s.id)).toEqual(["cluster|W1"]);
  });
  it("counts one outbreak once: signals on one unit with the same organism, close in time, are one episode", () => {
    const eps = unseenEpisodes([cluster, shiftFew, sentinel, gap, old, low], asOf, new Set(["gap|C9"]));
    expect(eps).toHaveLength(1);
    expect(eps[0]!.members.map((s) => s.id).sort()).toEqual([cluster.id, sentinel.id, shiftFew.id].sort());
    expect(eps[0]!.lead.severity).toBe("high");
  });
});

group("alert wording", () => {
  it("says what, where, who, in both languages, from the feed's own names", () => {
    const en = describe("en", meta, cluster, asOf);
    expect(en.title.text).toBe("Ward One: same resistant G. species (fluid) in 6 patients in 4 weeks");
    expect(renderToStaticMarkup(h("p", null, en.title.node))).toContain("<i");
    expect(en.audience).toBe("infection");
    expect(en.how).toContain("Normally fewer than 1");
    expect(en.chance).toBe("Statistically very unlikely to be chance.");
    // Resistance profile in the feed's order, as names, not codes.
    expect(renderToStaticMarkup(h("p", null, en.sub))).toContain("Resists zetamycin, alphacillin");
    const fi = describe("fi", meta, cluster, asOf);
    expect(fi.title.text).toBe("Osasto Yksi: sama resistentti G. species (neste) 6 potilaalla 4 viikossa");
  });
  it("never gives a percentage from fewer than 30 isolates", () => {
    const d = describe("en", meta, shiftFew, asOf);
    expect(d.title.text).toBe("Ward One: zetamycin works less often for G. species (fluid)");
    expect(d.how).toBe("Worked in 4 of 9 in the last 4 weeks, against 96% (48 of 50) in the 11 months before.");
    expect(d.short).toBe("Works 4 of 9 now · 96% before");
    expect(d.audience).toBe("stewardship");
    expect(d.casesLabel).toBe("See the 1 where it didn't work");
  });
  it("words a hospital-wide trend with its figures", () => {
    const d = describe("en", meta, trend, asOf);
    expect(d.title.text).toBe("Whole hospital: alphacillin resistance in G. species (fluid) rising, 17% → 20%");
    expect(d.where).toBe("Whole hospital · fluid");
    expect(d.casesLabel).toBeNull();
    expect(d.treat).toEqual({ organism: "Genus species", specimen: "s1" });
  });
  it("sends a data gap to the laboratory, not to treatment", () => {
    const d = describe("en", meta, gap, asOf);
    expect(d.title.text).toBe("Results stopped arriving from Clinic Nine");
    expect(d.audience).toBe("lab");
    expect(d.how).toBe("0 results in the last 7 days. Normally about 30.");
    expect(d.treat).toBeNull();
    expect(describe("fi", meta, gap, asOf).title.text).toBe("Tuloksia ei enää tule yksiköstä Klinikka Yhdeksän");
  });
  it("words a screening test as positive, not as a treatment that works", () => {
    const screen = { ...shiftFew, id: "shift|C9", ward: "C9", antibiotic: "SC", recent: { works: 5, n: 9 }, baseline: { works: 49, n: 50 } };
    const d = describe("en", meta, screen, asOf);
    expect(d.title.text).toBe("Clinic Nine: betoxin (screen) positive more often for G. species (fluid)");
    expect(d.how).toBe("Positive in 4 of 9 in the last 4 weeks, against 2% (1 of 50) in the 11 months before.");
    expect(d.audience).toBe("infection");
    expect(d.screen).toBe(true);
    expect(d.casesLabel).toBe("See the 1 positive");
  });
  it("names a rare find with its flag and organism", () => {
    const d = describe("en", meta, sentinel, asOf);
    expect(d.title.text).toBe("Ward One: QRX found in G. species");
    expect(d.when).toBe("On 29 Jun · yesterday");
    expect(d.treat).toEqual({ organism: "Genus species", ward: "W1", specimen: "s1" });
  });
});

group("alerts screen", () => {
  const props = {
    locale: "en" as const,
    meta,
    results: [result({}), result({ isolateId: "i2", patientId: "PX0099999", admissionDate: null, sex: "M", ageYears: 40 })],
    asOf,
    signals: [cluster, shiftFew, trend, gap, sentinel, old, low],
    seen: new Set(["gap|C9"]),
    onSeen: () => {},
    focus: null,
    onFocus: () => {},
    onOpenTreat: () => {},
    onOpenTimeline: () => {},
  };
  it("lists the active alerts with a summary line and the filters", () => {
    const html = renderToStaticMarkup(h(AlertsScreen, props));
    // The cluster, the shift and the rare find on Ward One are one outbreak: one card with a story.
    expect(html).toContain("2</strong> new · 3 active in the last 4 weeks");
    expect(html).toContain("3 linked");
    expect(html).toContain("alerts-storyline");
    expect(html).toContain("Checked up to 30 June 2025");
    expect(html).toContain("Results stopped arriving from Clinic Nine");
    expect(html).not.toContain("4 patients in 14 days"); // ended in January: not active
    expect(html).toContain("Hidden by the filters: 1"); // the low one
    expect(html).not.toMatch(/\b\d+%\s*\(4 of 9\)/);
  });
  it("shows cases without identifying the patient", () => {
    const d = describe("en", meta, cluster, asOf);
    const html = renderToStaticMarkup(
      h(Body, { ...props, s: cluster, d, seen: false, casesOpen: true }),
    );
    expect(html).toContain("Patient •••2345");
    expect(html).not.toContain("PX0012345");
    expect(html).toContain("day 5 of stay");
    expect(html).toContain("woman, 65 or over");
    expect(html).toContain("man, under 65");
    expect(html).toContain("outpatient");
    expect(html).toContain("Infection control");
    expect(html).toContain("What still works here");
    expect(patientTag("P005095")).toBe("5095");
  });
  it("shows a data gap as results per week, for the laboratory, without a treatment link", () => {
    const d = describe("en", meta, gap, asOf);
    const html = renderToStaticMarkup(h(Body, { ...props, results: [result({ ward: "C9", sampleDate: "2025-05-01" })], s: gap, d, seen: true }));
    expect(html).toContain("Results per week from this unit");
    expect(html).toContain("7 days to 30 Jun: 0");
    expect(html).toContain("The laboratory");
    expect(html).not.toContain("What still works here");
    expect(html).toContain("Seen");
  });
  it("says it is still checking before the first signals arrive", () => {
    const html = renderToStaticMarkup(h(AlertsScreen, { ...props, signals: [] }));
    expect(html).toContain("Checking the results for alerts");
  });
});
