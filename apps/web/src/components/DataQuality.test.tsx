import type { QualityResponse } from "@aei/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QualityResult } from "./DataQuality.tsx";

const clean: QualityResponse = { checked: { patients: 10, cultures: 20, isolates: 30, results: 40 }, summary: [] };
describe("data quality disclosure", () => {
  it("links directly from doctor source to the data checks, without inventing a check count", () => {
    const html = renderToStaticMarkup(<QualityResult data={clean} locale="fi" />);
    expect(html).toContain('href="#settings?section=data"');
    expect(html).toContain("Aineiston tarkistukset: 0 huomiota");
  });
  it("distinguishes a completed clean check from loading and clinical validation", () => {
    const html = renderToStaticMarkup(<QualityResult data={clean} locale="fi" expanded />);
    expect(html).toContain("10 potilasta, 20 viljelyä, 30 isolaattia, 40 tulosta");
    expect(html).toContain("Tarkistetussa aineistossa ei huomioita.");
    expect(html).toContain("ei kliinistä validointia");
    expect(html.match(/<li>/g)).toHaveLength(15);
    expect(html).toContain("Toistuvat tunnisteet: 0 huomiota");
  });
  it("lists API findings with translated check and severity labels in both locales", () => {
    const data: QualityResponse = {
      ...clean,
      summary: [
        { check: "age-mismatch", severity: "suspect", count: 3, examples: [] },
        { check: "missing-link", severity: "error", count: 2, examples: [] },
      ],
    };
    expect(renderToStaticMarkup(<QualityResult data={data} locale="fi" />)).toContain("5 huomiota");
    const fi = renderToStaticMarkup(<QualityResult data={data} locale="fi" expanded />);
    expect(fi).toContain("Ikä ei vastaa syntymävuotta: 3 huomiota");
    expect(fi).toContain("Puuttuvat viitatut rivit: 2 huomiota");
    const en = renderToStaticMarkup(<QualityResult data={data} locale="en" expanded />);
    expect(en).toContain("Verify");
    expect(en).toContain("Missing linked rows: 2 findings");
  });
});
