import type { QualityResponse } from "@aei/contract";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { t } from "../i18n/index.ts";
import { common } from "../i18n/messages/common.ts";
import { QualityCard, QualityLine } from "./Quality.tsx";

const data: QualityResponse = {
  checked: { patients: 10, cultures: 20, isolates: 30, results: 40 },
  summary: [],
};

describe("data check details", () => {
  it("lists exactly all fifteen CheckNames, including passed checks, in both languages", () => {
    for (const locale of ["en", "fi"] as const) {
      for (const component of [QualityLine, QualityCard]) {
        const html = renderToStaticMarkup(h(component, { locale, quality: { data, key: "0", failed: false } }));
        expect(html.match(/<li>/g)).toHaveLength(15);
        const labels = Object.entries(common[locale]).filter(([key]) => key.startsWith("common.quality.check."));
        expect(labels).toHaveLength(15);
        for (const [, label] of labels) expect(html).toContain(label.replaceAll("'", "&#x27;"));
        expect(html.match(new RegExp(`>${t(locale, "common.quality.checkPassed")}<`, "g"))).toHaveLength(15);
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('class="k-disc-body" hidden=""');
        expect(html).toContain(
          locale === "en"
            ? "10 patients, 20 cultures, 30 isolates and 40 results"
            : "10 potilasta, 20 viljelyä, 30 kantaa ja 40 herkkyystulosta",
        );
      }
    }
  });
  it("uses the returned finding count and severity, while other checks pass", () => {
    const findings: QualityResponse = {
      ...data,
      summary: [
        { check: "missing-link", severity: "error", count: 2, examples: [] },
        { check: "ward-type", severity: "suspect", count: 1, examples: [] },
      ],
    };
    const html = renderToStaticMarkup(h(QualityLine, { locale: "en", quality: { data: findings, key: "0", failed: false } }));
    expect(html).toContain("Data checks: 3 findings");
    expect(html).toContain("Error: 2 findings");
    expect(html).toContain("To verify: 1 finding");
    expect(html.match(/>Passed</g)).toHaveLength(13);
  });
  it("does not claim checks passed if the route is unavailable", () => {
    const html = renderToStaticMarkup(h(QualityLine, { locale: "en", quality: { data: null, key: "0", failed: true } }));
    expect(html).toContain("This server does not report data checks.");
    expect(html).not.toContain("passed");
  });
});
