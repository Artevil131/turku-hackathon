import { type Alert, createAeiClient } from "@aei/contract";
import { METHODS } from "@aei/method";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupIncidents } from "../feed/model.ts";
import { AlertMath, citation, countRows, howSentence, MethodEntry, oddsPhrase } from "./AlertMath.tsx";

const client = createAeiClient({ baseUrl: "http://localhost" });

function card(alert: Alert, locale: "en" | "fi" = "en", asOf: string | null = "2025-06-09", layer = false) {
  const incident = groupIncidents([alert])[0];
  if (!incident) throw new Error("no incident");
  return renderToStaticMarkup(
    <AlertMath
      client={client}
      locale={locale}
      incident={incident}
      spans={null}
      findings={[]}
      onChange={() => {}}
      acknowledge={() => {}}
      empty="pick"
      asOf={asOf}
      command={() => {}}
      onBack={layer ? () => {} : undefined}
    />,
  );
}

const sentence = (html: string) => html.match(/class="sig-how-text">([^<]*)</)?.[1] ?? "";

const cluster: Alert = {
  kind: "detector",
  detector: "profile-excess",
  id: "c1",
  date: "2025-06-09",
  ward: "URO",
  organism: "Escherichia coli",
  profile: "RRRSSSSSSSSSS",
  observed: 5,
  expected: 0.2,
  p: 2e-5,
};

const cpe = { kind: "cpe", id: "s2", date: "2025-06-09", ward: "ICU", organism: "Klebsiella pneumoniae", specimen: "urine" } as Alert;

describe("the signal card", () => {
  it("states the cluster method with its numbers, the surprise and the odds", () => {
    const html = card(cluster);
    const s = sentence(html);
    expect(s).toContain("last 28 days");
    expect(s).toContain("(5)");
    expect(s).toContain("(0.2)");
    expect(s).toContain("1 in 50,000");
    expect(html).toContain(">4.7<");
    expect(html).toContain("surprise · 1 in 50,000 by chance");
    expect(html).toContain("5 patients");
    expect(html).toContain("0.2 usual");
    expect(html).toContain("Data behind it");
    expect(html).toContain('class="sig-btn" href="#method"');
  });

  it("states the sentinel as a rule, with the 180 days, and shows no bars", () => {
    const html = card({
      kind: "new-in-unit",
      id: "s1",
      date: "2025-06-09",
      ward: "ICU",
      phenotype: "mrsa",
      organism: "Staphylococcus aureus",
      previous: null,
    } as Alert);
    expect(sentence(html)).toBe("A rule, no test: the first MRSA on this inpatient unit in 180 days.");
    expect(html).not.toContain("sig-bars");
    expect(html).not.toContain("sig-surprise");
    expect(sentence(card(cpe))).toContain("every CPE is an alert");
  });

  it("states the data alert with this week's count and the usual week", () => {
    const html = card({
      kind: "detector",
      detector: "sampling-drop",
      id: "d1",
      date: "2025-06-09",
      ward: "MED-A",
      observed: 0,
      expected: 14.3,
      p: 3e-7,
    });
    const s = sentence(html);
    expect(s).toContain("(0)");
    expect(s).toContain("(14.3)");
    expect(s).toContain("feed or sampling problem");
    expect(html).not.toContain("sig-isolates");
  });

  it("renders the method block: name, MathML formula, constants with decisions, code with copy", () => {
    const html = renderToStaticMarkup(
      <MethodEntry
        locale="en"
        method={METHODS["profile-excess"]}
        values={{ ward: "URO", organism: "Escherichia coli", from: "2025-05-12", to: "2025-06-09" }}
      />,
    );
    expect(html).toContain("Poisson upper tail, hospital-wide baseline");
    expect(html).toContain("<math ");
    expect(html).toContain("Copy LaTeX");
    expect(html).toContain('<dt>alpha</dt><dd>0.0001 <span class="sig-decision">D-020</span>');
    expect(html).toContain("aei.detect.profile_excess");
    expect(html).toContain("s.ward == &quot;URO&quot;");
    const noPy = renderToStaticMarkup(
      <MethodEntry locale="en" method={METHODS.cpe} values={{ ward: "ICU", organism: "", from: "a", to: "b" }} />,
    );
    expect(noPy).toContain("No Python function yet");
  });

  it("caps the odds under one in a million and speaks Finnish", () => {
    expect(oddsPhrase("en", 1e-9)).toBe("less than 1 in 1 000 000");
    expect(howSentence("fi", cluster)).toContain("viimeisten 28 päivän");
    expect(card({ ...cluster, p: 1e-9 })).toContain("more than 1 in 1 000 000 by chance");
  });

  it("disables the day button on the clock's day only", () => {
    const button = (html: string) => html.match(/<button[^>]*sig-primary[^>]*>/)?.[0] ?? "";
    expect(button(card(cluster, "en", "2025-06-09"))).toContain("disabled");
    expect(button(card(cluster, "en", "2025-06-01"))).not.toContain("disabled");
  });

  it("as a layer: the method open, the data section with its counts and copy buttons, no reading in words", () => {
    const html = card(cluster, "en", "2025-06-09", true);
    expect(html).toMatch(/<details class="sig-how" open="">/);
    expect(html).toContain(
      '<section class="sig-data" aria-labelledby="sig-data-c1"><h3 class="sig-section-title" id="sig-data-c1">Data behind it</h3>',
    );
    expect(html).toContain('<th scope="row"><i class="sig-sym">y</i>Observed</th><td>5</td>');
    expect(html).toContain('<th scope="row"><i class="sig-sym">μ</i>Expected</th><td>0.2</td>');
    expect(html).toContain("<td>2.00e-5</td>");
    expect(html).toContain("<td>2025-05-13 – 2025-06-09</td>");
    expect(html).toContain("<td>2024-05-13 – 2025-05-12</td>");
    expect(html).toContain(">Copy JSON<");
    expect(html).toContain(">Copy citation<");
    expect(html).toContain(">Copy LaTeX<");
    expect(html).toContain('role="status"');
    expect(html).toContain(">R</button>");
    for (const gone of ["What this signal may mean", "interpretation, not a diagnosis", "More of one rare", "sig-means"])
      expect(html).not.toContain(gone);
    // The sentence in words lives only inside the "In plain words" fold.
    const fold = html.indexOf('<details class="sig-plain">');
    expect(fold).toBeGreaterThan(0);
    expect(html.indexOf('class="sig-how-text"')).toBeGreaterThan(fold);
  });

  it("reads the counts off the alert and cites the method with its decisions", () => {
    const rows = countRows("en", cluster, METHODS["profile-excess"]);
    expect(rows.find((r) => r.sym === "α")?.value).toBe("0.0001");
    expect(rows.find((r) => r.name === "Unit")?.value).toBe("URO");
    expect(citation(METHODS["profile-excess"], "2025-06-09", "http://x/#research?inc=c1")).toBe(
      "AEI (Antibiotic Efficacy Indicator), Poisson upper tail, hospital-wide baseline, D-020, D-042, as of 2025-06-09, http://x/#research?inc=c1",
    );
  });

  it("offers the R snippet: the package read with aei and AMR, cut to this unit", () => {
    const html = renderToStaticMarkup(
      <MethodEntry
        locale="en"
        method={METHODS["phenotype-excess"]}
        values={{ ward: "URO", organism: "", from: "2025-05-12", to: "2025-06-09", phenotype: "esbl", expected: "1.5" }}
      />,
    );
    expect(html).toContain(">R</button>");
  });
});
