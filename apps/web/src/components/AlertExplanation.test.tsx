import { createAeiClient } from "@aei/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlertExplanation } from "./AlertExplanation.tsx";
import { groupIncidents } from "./research/feed/model.ts";
import { AlertMath } from "./research/math/AlertMath.tsx";

const client = createAeiClient({ baseUrl: "http://localhost" });

describe("explanation controls", () => {
  it.each(["fi", "en"] as const)("renders a named native disclosure button in %s", (locale) => {
    const html = renderToStaticMarkup(<AlertExplanation client={client} id="alert-1" locale={locale} />);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/aria-controls="[^"]+"/);
    expect(html).toContain(locale === "fi" ? "Selitä" : "Explain");
  });
  it("puts the incident and responsible party before the calculation, with dated member explanations", () => {
    const incident = groupIncidents([
      {
        kind: "detector",
        detector: "profile-excess",
        id: "profile",
        incident: "event",
        date: "2025-06-06",
        ward: "URO",
        organism: "Escherichia coli",
        observed: 3,
        expected: 0.2,
      },
      {
        kind: "detector",
        detector: "phenotype-excess",
        id: "surge",
        incident: "event",
        date: "2025-06-07",
        ward: "URO",
        phenotype: "esbl",
        observed: 2,
        expected: 0.3,
      },
    ])[0];
    if (!incident) throw new Error("Missing test incident");
    const html = renderToStaticMarkup(
      <AlertMath
        client={client}
        locale="en"
        incident={incident}
        spans={null}
        findings={[]}
        onChange={() => {}}
        acknowledge={() => {}}
        empty="pick"
      />,
    );
    expect(html).toContain("One incident · 2 related alerts");
    expect(html).toContain("responsible doctor for Urology");
    expect(html).toContain("2 patients observed · expected 0.3");
    expect(html).toContain('dateTime="2025-06-06"');
    expect(html).toContain('dateTime="2025-06-07"');
    expect(html.indexOf("responsible doctor")).toBeLessThan(html.indexOf('class="math-block"'));
    expect(html.indexOf("Explain")).toBeLessThan(html.indexOf('class="math-block"'));
  });
});
