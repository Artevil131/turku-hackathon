import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedClock, FeedMeta } from "../feed/types.ts";
import { AwareBadge, Badge, SeverityBadge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { ChipGroup } from "./Chips.tsx";
import { defaultSpecimen, defaultWard, sexLabel } from "./defaults.ts";
import { EmptyState } from "./EmptyState.tsx";
import { Org, shortOrganism } from "./Org.tsx";
import { Picker } from "./Picker.tsx";
import { Segmented } from "./Segmented.tsx";
import { Settings } from "./Settings.tsx";
import { ShareBar } from "./ShareBar.tsx";
import { FreshChip, Header, Tabs } from "./Shell.tsx";
import { SimControl } from "./SimControl.tsx";
import { Sparkline } from "./Sparkline.tsx";

// Server-rendered smoke tests of the kit: every component renders, and the
// rules the product promises hold in the markup.

const meta: FeedMeta = {
  start: "2024-01-01",
  end: "2024-12-31",
  units: [
    { code: "U1", en: "Outpatients", fi: "Poliklinikka", type: "out", institution: "hospital" },
    { code: "U2", en: "Ward Two", fi: "Osasto Kaksi", type: "in", institution: "hospital" },
  ],
  antibiotics: [{ code: "A1", en: "drug one", fi: "lääke yksi", class: "c", reportedFor: "all" }],
  organisms: ["Genus species"],
  specimens: [{ code: "s1", en: "sample", fi: "näyte" }],
  ai: false,
};
const clock: FeedClock = { asOf: "2024-06-01", start: "2024-01-01", end: "2024-12-31", running: false, tickMs: 2000, daysPerTick: 1 };

describe("ShareBar", () => {
  it("shows a percentage and the count it rests on", () => {
    const html = renderToStaticMarkup(h(ShareBar, { locale: "en", share: { works: 41, n: 47 } }));
    expect(html).toContain("87%");
    expect(html).toContain("works in 41 of 47");
  });
  it("never shows a percentage below the minimum", () => {
    const html = renderToStaticMarkup(h(ShareBar, { locale: "en", share: { works: 9, n: 12 } }));
    expect(html).not.toMatch(/\d+%/);
    expect(html).toContain("Too few (12)");
    expect(html).toContain("at least 30");
  });
  it("draws a reference tick only when the reference reaches the minimum", () => {
    const withRef = renderToStaticMarkup(
      h(ShareBar, { locale: "fi", share: { works: 40, n: 40 }, reference: { share: { works: 30, n: 40 }, label: "Vuosi" } }),
    );
    expect(withRef).toContain("k-share-ref");
    const tooFew = renderToStaticMarkup(
      h(ShareBar, { locale: "fi", share: { works: 40, n: 40 }, reference: { share: { works: 3, n: 4 }, label: "Vuosi" } }),
    );
    expect(tooFew).not.toContain("k-share-ref");
  });
});

describe("kit", () => {
  it("badges always carry a word", () => {
    expect(renderToStaticMarkup(h(SeverityBadge, { locale: "en", severity: "high" }))).toContain("High");
    expect(renderToStaticMarkup(h(AwareBadge, { locale: "fi", group: "access" }))).toContain("Ensisijainen");
    expect(renderToStaticMarkup(h(AwareBadge, { locale: "en", group: null }))).toBe("");
    expect(renderToStaticMarkup(h(Badge, { tone: "medium" } as Parameters<typeof Badge>[0], "x"))).toContain("◆");
  });
  it("renders the remaining components", () => {
    const parts = [
      h(Card, { title: "T", footer: "f" }, "c"),
      h(Segmented, {
        label: "L",
        value: "a",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        onChange: () => {},
      }),
      h(ChipGroup, { label: "L", value: null, options: [{ value: "a", label: "A" }], onChange: () => {}, anyLabel: "Any" }),
      h(Picker, {
        locale: "en",
        label: "Unit",
        value: "U1",
        groups: [{ options: meta.units.map((u) => ({ value: u.code, label: u.en })) }],
        onChange: () => {},
      }),
      h(Sparkline, { values: [0.1, null, 0.2, 0.3], label: "trend", band: { lo: [0, 0, 0, 0], hi: [0.4, 0.4, 0.4, 0.4] } }),
      h(EmptyState, { title: "Nothing" }),
      h(Org, { name: "Genus species", short: true }),
      h(FreshChip, { locale: "en", status: "live", asOf: "2025-05-12", arrivalSeq: 1, checking: false, short: false }),
      h(Tabs, { locale: "en", route: "alerts", alertsBadge: 3, variant: "bottom" }),
      h(Header, { locale: "fi", route: "treat", desktop: true, fresh: null, alertsBadge: 0, ask: null }),
      h(SimControl, { locale: "en", clock, onControl: async () => {}, desktop: true }),
      h(Settings, {
        locale: "en",
        onLocale: () => {},
        meta,
        asOf: "2024-06-01",
        resultCount: 1234,
        quality: { data: null, failed: true, key: "0:0" },
        ai: { available: false, model: null, checking: false },
        onCheckAi: () => {},
        onForget: () => {},
      }),
    ];
    for (const p of parts) expect(renderToStaticMarkup(p).length).toBeGreaterThan(0);
  });
  it("labels the freshness and the alerts badge in words", () => {
    expect(
      renderToStaticMarkup(
        h(FreshChip, { locale: "fi", status: "live", asOf: "2025-05-12", arrivalSeq: 0, checking: false, short: false }),
      ),
    ).toContain("Tulokset 12. toukokuuta 2025 asti");
    expect(renderToStaticMarkup(h(Tabs, { locale: "en", route: "treat", alertsBadge: 3, variant: "top" }))).toContain("3 new");
  });
});

describe("defaults come from the feed", () => {
  it("picks the first hospital inpatient unit and the first specimen", () => {
    expect(defaultWard(meta)).toBe("U2");
    expect(defaultSpecimen(meta)).toBe("s1");
  });
  it("abbreviates any organism name and passes unknown sex codes through", () => {
    expect(shortOrganism("Genus species")).toBe("G. species");
    expect(shortOrganism("Single")).toBe("Single");
    expect(sexLabel("en", "F")).toBe("Women");
    expect(sexLabel("en", "X")).toBe("X");
  });
});
