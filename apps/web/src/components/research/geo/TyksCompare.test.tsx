import type { WeeklyResponse } from "@aei/contract";
import { PHENOTYPES, WARDS } from "@aei/domain";
import { addDaysIso } from "@aei/viz";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TyksCompare } from "./TyksCompare.tsx";

const weekly: WeeklyResponse = {
  asOf: "2026-10-17",
  weeks: Array.from({ length: 8 }, (_, i) => addDaysIso("2026-08-24", i * 7)),
  units: Object.fromEntries(
    WARDS.map((w) => [
      w.code,
      { cultures: Array(8).fill(100), phenotypes: Object.fromEntries(PHENOTYPES.map((p) => [p, Array(8).fill(p === "mrsa" ? 1 : 2)])) },
    ]),
  ) as WeeklyResponse["units"],
};

describe("TyksCompare", () => {
  it("names the synthetic source, counting unit, windows and limits in Finnish", () => {
    const html = renderToStaticMarkup(<TyksCompare weekly={weekly} group="MRSA carriage" locale="fi" />);
    expect(html).toContain("Tyks, sama fenotyyppi · MRSA");
    expect(html).toContain("Synteettinen demoaineisto");
    expect(html).toContain("Viimeiset 4 viikkoa");
    expect(html).toContain("Edelliset 4 viikkoa");
    expect(html).toContain(`<strong>${WARDS.length * 4}</strong>`);
    expect(html).toContain("Potilas–yksikköviikot");
    expect(html).toContain("Kahdessa yksikössä oleva potilas");
    expect(html).toContain("Viimeisin viikko on kesken");
    expect(html).toContain("Vertailu on suuntaa antava: eri aineistot ja eri määritelmät.");
    expect(html).not.toContain("100 000");
  });
  it.each(["ESBL blood/CSF, E. coli", "VRE carriage", "CPE carriage, E. coli"])(
    "renders the matching phenotype in English: %s",
    (group) => {
      const html = renderToStaticMarkup(<TyksCompare weekly={weekly} group={group} locale="en" />);
      expect(html).toContain(`Tyks, same phenotype · ${group.split(" ")[0]}`);
      expect(html).toContain(`<strong>${WARDS.length * 8}</strong>`);
      expect(html).toContain("Not unique hospital patients.");
      expect(html).toContain("Synthetic demo data");
    },
  );
  it("does not label a completed latest week partial", () => {
    const html = renderToStaticMarkup(<TyksCompare weekly={{ ...weekly, asOf: "2026-10-18" }} group="MRSA carriage" locale="en" />);
    expect(html).not.toContain("latest week is partial");
  });
  it("shows unavailable, not zero, for insufficient history", () => {
    const html = renderToStaticMarkup(
      <TyksCompare weekly={{ ...weekly, weeks: weekly.weeks.slice(0, 7) }} group="MRSA carriage" locale="en" />,
    );
    expect(html).toContain("Eight weeks of hospital data are needed");
    expect(html).not.toContain("<dl>");
  });
  it("does not silently fall back to another phenotype", () => {
    const html = renderToStaticMarkup(<TyksCompare weekly={weekly} group="unknown" locale="en" />);
    expect(html).toContain("No matching hospital phenotype");
    expect(html).not.toContain("<dl>");
  });
});
