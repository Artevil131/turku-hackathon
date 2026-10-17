import type { RegionalResponse } from "@aei/contract";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { formatNumber, t } from "../i18n/index.ts";
import { RegionalCard } from "../screens/Timeline/Regional.tsx";
import { Settings } from "./Settings.tsx";
import { useRegional } from "./useRegional.ts";

vi.mock("./useRegional.ts", () => ({ useRegional: vi.fn() }));
const data: RegionalResponse = {
  source: "THL",
  fetched: "2026-10-16",
  asOf: "2025-06-01",
  settings: { firstTarget: "2024-01", baseline: 36, alpha: 0.001, minCases: 5, familyAlpha: 0.05, testedSeriesMonths: 12345 },
  months: ["2025-05"],
  groups: [],
  regions: [],
  series: [],
  signals: [],
};

describe("regional provenance and method", () => {
  it("keeps a focusable jump target even while loading, unavailable or failed", () => {
    for (const status of ["loading", "missing", "failed"] as const) {
      vi.mocked(useRegional).mockReturnValue({ status });
      const html = renderToStaticMarkup(h(RegionalCard, { locale: "en", asOf: data.asOf }));
      expect(html).toContain('id="timeline-region" tabindex="-1"');
      expect(html).toContain("Unusual county-months");
    }
  });
  it("provides the method even when there are no signals, in both languages", () => {
    vi.mocked(useRegional).mockReturnValue({ status: "ok", data });
    for (const locale of ["en", "fi"] as const) {
      const html = renderToStaticMarkup(h(RegionalCard, { locale, asOf: data.asOf }));
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain(t(locale, "timeline.region.method"));
      expect(html).toContain("36");
      expect(html).toContain("Bonferroni");
      expect(html).toContain(formatNumber(locale, data.settings.testedSeriesMonths));
      expect(html).toContain("CC BY 4.0");
      expect(html).toContain(locale === "en" ? "Quasi-Poisson" : "Kvasipoisson");
      expect(html).toContain(locale === "en" ? "0.001" : "0,001");
    }
  });
  it("separates demo hospital data from real THL data and shows the fetch date in Settings", () => {
    vi.mocked(useRegional).mockReturnValue({ status: "ok", data });
    for (const locale of ["en", "fi"] as const) {
      const html = renderToStaticMarkup(
        h(Settings, {
          locale,
          onLocale: () => {},
          meta: null,
          asOf: data.asOf,
          resultCount: 0,
          quality: { data: null, failed: false, key: null },
          ai: { available: false, model: null, checking: false },
          onCheckAi: () => {},
          onForget: () => {},
        }),
      );
      expect(html).toContain(locale === "en" ? "synthetic Tyks dataset" : "synteettinen Tyksin aineisto");
      expect(html).toContain(locale === "en" ? "real public THL" : "THL:n todellisiin julkisiin");
      expect(html).toContain(locale === "en" ? "16 October 2026" : "16. lokakuuta 2026");
      expect(html).toContain("CC BY 4.0");
    }
  });
});
