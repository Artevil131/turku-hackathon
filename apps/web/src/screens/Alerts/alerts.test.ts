import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, describe as group, it, vi } from "vitest";
import type { FeedMeta, Result } from "../../feed/types.ts";
import { toSignals } from "../../model/alerts.ts";
import type { Signal } from "../../model/types.ts";
import { store } from "../../ui/hooks.ts";
import { describe } from "./describe.tsx";
import { DEFAULT_FILTERS, isActive, passes, reveal, sortAlerts, unseenActive } from "./filters.ts";
import { AlertsScreen } from "./index.tsx";
import { Body, patientTag, Summary } from "./parts.tsx";

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
  source: "profile-excess",
  related: [],
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
  source: "cpe",
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
const old = sig({
  id: "old",
  kind: "surge",
  severity: "high",
  firstDate: "2025-01-01",
  lastDate: "2025-01-10",
  phenotype: "abc",
  observed: 4,
  expected: 1.2,
});
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
});

group("alert wording", () => {
  it("says what, where, who, in both languages, from the feed's own names", () => {
    const en = describe("en", meta, cluster, asOf);
    expect(en.title.text).toBe("Same resistant G. species (fluid) in 6 patients on Ward One in 4 weeks");
    expect(renderToStaticMarkup(h("p", null, en.title.node))).toContain("<i");
    expect(en.audience).toBe("infection");
    expect(en.how).toContain("Normally fewer than 1");
    expect(en.chance).toBe("Statistically very unlikely to be chance.");
    // Resistance profile in the feed's order, as names, not codes.
    expect(renderToStaticMarkup(h("p", null, en.sub))).toContain("Resists zetamycin, alphacillin");
    const fi = describe("fi", meta, cluster, asOf);
    expect(fi.title.text).toBe("Sama resistentti G. species (neste) 6 potilaalla yksikössä Osasto Yksi 4 viikossa");
  });
  it("words a hospital-wide trend with its figures", () => {
    const d = describe("en", meta, trend, asOf);
    expect(d.title.text).toBe("Alphacillin resistance in G. species from fluid rising hospital-wide: 17% → 20%");
    expect(d.where).toBe("Whole hospital · fluid");
    expect(d.casesLabel).toBeNull();
    expect(d.treat).toEqual({ specimen: "s1" });
  });
  it("sends a data gap to the laboratory, not to treatment", () => {
    const d = describe("en", meta, gap, asOf);
    expect(d.title.text).toBe("Results stopped arriving from Clinic Nine");
    expect(d.audience).toBe("lab");
    expect(d.how).toBe("0 results in the last 7 days. Normally about 30.");
    expect(d.treat).toBeNull();
    expect(describe("fi", meta, gap, asOf).title.text).toBe("Tuloksia ei enää tule yksiköstä Klinikka Yhdeksän");
  });
  it("words the server's trend from its latest block when no shares are sent", () => {
    const server = { ...trend, id: "trend|y", source: "rising-trend" as const, observed: 0.2 };
    delete (server as Partial<Signal>).recent;
    delete (server as Partial<Signal>).baseline;
    const d = describe("en", meta, server, asOf);
    expect(d.title.text).toBe("Alphacillin resistance in G. species from fluid rising hospital-wide");
    expect(d.how).toBe("20% resistant in the latest 28-day block; the rise over the blocks before it is unlikely to be chance.");
  });
  it("words an empty run as results that stopped, over the run's own days", () => {
    const run = { ...gap, id: "gap|run", source: "empty-run" as const, observed: 0, expected: 12, windowDays: 4 };
    expect(describe("en", meta, run, asOf).how).toBe("0 results in the last 4 days. Normally about 12.");
  });
  it("keeps the patient count and responsible team together by the incident heading", () => {
    for (const locale of ["en", "fi"] as const) {
      const d = describe(locale, meta, sentinel, asOf);
      const html = renderToStaticMarkup(h(Summary, { locale, d, control: d.title.node, level: 2 }));
      const facts = html.slice(html.indexOf('class="alerts-heading-facts"'));
      expect(facts).toContain(locale === "en" ? "1 patient" : "1 potilas");
      expect(facts).toContain(locale === "en" ? "Infection control" : "Infektioiden torjunta");
    }
  });
  it("names a rare find with its flag and organism", () => {
    const d = describe("en", meta, sentinel, asOf);
    expect(d.title.text).toBe("QRX found: G. species on Ward One");
    expect(d.when).toBe("On 29 Jun · yesterday");
    expect(d.treat).toEqual({ ward: "W1", specimen: "s1" });
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
    expect(html).toContain("4</strong> not yet marked seen · 5 active in the last 4 weeks");
    expect(html).toContain('href="#timeline"');
    expect(html).toContain("Real THL county signals");
    expect(html).toContain("Checked up to 30 June 2025");
    expect(html).toContain("Results stopped arriving from Clinic Nine");
    expect(html).not.toContain("4 patients in 14 days"); // ended in January: not active
    expect(html).toContain("Hidden by the filters: 1"); // the low one
    expect(html).not.toMatch(/\b\d+%\s*\(4 of 9\)/);
  });
  it("shows the previous browser visit, not the replay date, and rejects invalid saved values", () => {
    const saved = vi.spyOn(store, "get");
    try {
      saved.mockReturnValue("2026-10-14T14:00:00.000Z");
      expect(renderToStaticMarkup(h(AlertsScreen, props))).toContain("This browser last opened Alerts on 14 October 2026.");
      expect(renderToStaticMarkup(h(AlertsScreen, { ...props, locale: "fi" }))).toContain("14. lokakuuta 2026");
      for (const value of [undefined, "invalid", "5", 123]) {
        saved.mockReturnValue(value);
        expect(renderToStaticMarkup(h(AlertsScreen, props))).toContain("No previous Alerts visit saved in this browser.");
      }
    } finally {
      saved.mockRestore();
    }
  });
  it("relates incident patients by patient identity even when their isolate ids differ", () => {
    const s = { ...cluster, related: [{ ...shiftFew, isolateIds: ["i3", "i4"] }] };
    const cases = [...props.results, result({ isolateId: "i3" }), result({ isolateId: "i4", patientId: "PX0088888" })];
    for (const locale of ["en", "fi"] as const) {
      const html = renderToStaticMarkup(h(Body, { ...props, locale, results: cases, s, d: describe(locale, meta, s, asOf), seen: false }));
      expect(html).toContain(
        locale === "en"
          ? "Patients in both: 1 · only above: 1 · only in this related alert: 1."
          : "Potilaita molemmissa: 1 · vain yllä: 1 · vain tässä liittyvässä hälytyksessä: 1.",
      );
    }
    const html = renderToStaticMarkup(h(Body, { ...props, s, d: describe("en", meta, s, asOf), seen: false }));
    expect(html).toContain("Patient overlap cannot be determined from the released cases.");
    expect(html).not.toContain("Patients in both: 0");
  });
  it("keeps a folded incident's lead cases separate from its related alert's cases", () => {
    const cases = [
      result({ isolateId: "i1", ward: "URO", sampleDate: "2025-06-15", phenotypes: ["esbl"] }),
      result({ isolateId: "i2", patientId: "PX0099999", ward: "URO", sampleDate: "2025-06-15", phenotypes: ["esbl"] }),
      result({ isolateId: "i3", patientId: "PX0088888", ward: "URO", sampleDate: "2025-06-22", phenotypes: ["esbl"] }),
    ];
    const [s] = toSignals(
      [
        {
          kind: "detector",
          id: "lead",
          incident: "lead",
          date: "2025-06-20",
          ward: "URO",
          detector: "phenotype-excess",
          phenotype: "esbl",
          observed: 2,
        },
        {
          kind: "detector",
          id: "related",
          incident: "lead",
          date: "2025-06-25",
          ward: "URO",
          detector: "phenotype-excess",
          phenotype: "esbl",
          observed: 3,
        },
      ],
      cases,
    );
    expect(s?.patients).toBe(2);
    expect(s?.isolateIds).toEqual(["i1", "i2"]);
    expect(s?.related[0]?.isolateIds).toEqual(["i1", "i2", "i3"]);
    if (!s) throw new Error("Expected the folded incident");
    const html = renderToStaticMarkup(h(Body, { ...props, results: cases, s, d: describe("en", meta, s, asOf), seen: false }));
    expect(html).toContain("Patients in both: 2 · only above: 0 · only in this related alert: 1.");
  });
  it("shows cases without identifying the patient", () => {
    const d = describe("en", meta, cluster, asOf);
    const html = renderToStaticMarkup(h(Body, { ...props, s: cluster, d, seen: false, casesOpen: true }));
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
    const html = renderToStaticMarkup(
      h(Body, { ...props, results: [result({ ward: "C9", sampleDate: "2025-05-01" })], s: gap, d, seen: true }),
    );
    expect(html).toContain("Results per week from this unit");
    expect(html).toContain("Last 7 days: 0");
    expect(html).toContain("The laboratory");
    expect(html).not.toContain("What still works here");
    expect(html).toContain("Seen");
  });
  it("says it is still checking before the first signals arrive", () => {
    const html = renderToStaticMarkup(h(AlertsScreen, { ...props, signals: [] }));
    expect(html).toContain("Checking the results for alerts");
  });
});
