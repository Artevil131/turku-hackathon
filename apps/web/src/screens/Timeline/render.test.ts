import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Signal } from "../../model/types.ts";
import type { FeedClock, FeedMeta, Result } from "../../feed/types.ts";
import { TimelineScreen } from "./index.tsx";

// Smoke test: the screen renders from feed data alone, in both languages,
// shows NOW and the "not yet" zone, and never prints a date after asOf in its signals.

const meta: FeedMeta = {
  start: "2024-01-01",
  end: "2024-12-29",
  units: [
    { code: "W1", en: "Ward one", fi: "Osasto yksi", type: "in", institution: "hospital" },
    { code: "W2", en: "Ward two", fi: "Osasto kaksi", type: "out", institution: "primary_care" },
  ],
  antibiotics: [{ code: "AB", en: "drugcillin", fi: "drugsilliini", class: "x", reportedFor: "all" }],
  organisms: ["Genus species"],
  specimens: [{ code: "s1", en: "sample", fi: "näyte" }],
  ai: false,
};

const results: Result[] = [];
for (let d = 1; d <= 28; d++) {
  for (let i = 0; i < 3; i++) {
    const day = `2024-02-${String(d).padStart(2, "0")}`;
    results.push({
      isolateId: `${day}-${i}`,
      cultureId: `${day}-${i}`,
      patientId: `p${d}-${i}`,
      sampleDate: day,
      admissionDate: null,
      ward: i === 0 ? "W2" : "W1",
      specimen: "s1",
      organism: "Genus species",
      sex: "F",
      ageYears: 40,
      phenotypes: i === 1 ? ["esbl"] : [],
      results: { AB: i === 1 ? "R" : "S" },
    });
  }
}

const signals: Signal[] = [
  { id: "s1", kind: "cluster", source: "profile-excess", related: [], severity: "high", firstDate: "2024-02-10", lastDate: "2024-02-20", ward: "W1", organism: "Genus species", resists: ["AB"], observed: 5, expected: 0.4, isolateIds: ["a", "b", "c"] },
  { id: "s2", kind: "trend", source: "rising-trend", related: [], severity: "medium", firstDate: "2024-02-01", lastDate: "2024-02-28", ward: null, organism: "Genus species", specimen: "s1", antibiotic: "AB", observed: 30, expected: 20, isolateIds: [], recent: { works: 20, n: 25 }, baseline: { works: 80, n: 100 } },
  { id: "late", kind: "surge", source: "phenotype-excess", related: [], severity: "high", firstDate: "2024-03-10", lastDate: "2024-03-12", ward: "W1", observed: 4, isolateIds: [] },
];

const clock: FeedClock = { asOf: "2024-02-28", start: meta.start, end: meta.end, running: false, tickMs: 1000, daysPerTick: 1 };

describe("Timeline screen", () => {
  for (const locale of ["en", "fi"] as const) {
    it(`renders in ${locale}`, () => {
      const html = renderToStaticMarkup(
        createElement(TimelineScreen, { locale, meta, results, asOf: "2024-02-28", clock, signals, onSeek: () => {}, onOpenSignal: () => {} }),
      );
      expect(html).toContain(locale === "en" ? "Ward one" : "Osasto yksi");
      expect(html).toContain("timeline-now");
      expect(html).toContain("timeline-future");
      expect(html).toContain("<i class=\"k-org\"");
      // The signal that starts after asOf is not drawn or listed.
      expect(html).not.toContain("10 Mar");
      expect(html).not.toContain("10.3.");
      // Too few for a percentage: the trend's recent 5 of 25 is shown as a count.
      expect(html).toMatch(/5 of 25|5\/25/);
    });
  }
});
