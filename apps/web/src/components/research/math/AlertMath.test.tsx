import { type Alert, createAeiClient } from "@aei/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupIncidents } from "../feed/model.ts";
import { AlertMath, howSentence, oddsPhrase } from "./AlertMath.tsx";

const client = createAeiClient({ baseUrl: "http://localhost" });

function card(alert: Alert, locale: "en" | "fi" = "en", asOf: string | null = "2025-06-09") {
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
    expect(html).toContain("Isolates behind it");
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
    const cpe = { kind: "cpe", id: "s2", date: "2025-06-09", ward: "ICU", organism: "Klebsiella pneumoniae", specimen: "urine" } as Alert;
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
});
