import type { Alert } from "@aei/contract";
import { describe, expect, it } from "vitest";
import { buildEntries, normalize, recentAlerts, search } from "./match.ts";

const alert = (over: Partial<Alert> & { id: string; date: string }): Alert =>
  ({ kind: "cpe", ward: "URO", organism: "Klebsiella pneumoniae", ...over }) as unknown as Alert;

const ALERTS: Alert[] = [
  alert({ id: "cpe:1", date: "2025-05-10" }),
  alert({ id: "cpe:2", date: "2025-05-11", incident: "cpe:1" }),
  alert({ id: "cpe:old", date: "2025-03-01" }),
  alert({ id: "cpe:future", date: "2025-06-01" }),
];
const AS_OF = "2025-05-12";

const ids = (locale: "fi" | "en", q: string, alerts = ALERTS) => search(buildEntries(locale, alerts, AS_OF), q).map((r) => r.id);

describe("normalize", () => {
  it("drops case and diacritics", () => {
    expect(normalize("  Päivystys ")).toBe("paivystys");
    expect(normalize("Etelä")).toBe("etela");
  });
});

describe("search", () => {
  it("finds a unit by Finnish name without diacritics, in either UI language", () => {
    expect(ids("en", "paivys")).toContain("doctor:ED");
    expect(ids("fi", "PAIVYSTYS")).toContain("signals:ED");
  });
  it("finds a unit by English name and by code", () => {
    expect(ids("fi", "intensive")).toContain("doctor:ICU");
    expect(ids("en", "uro")).toContain("doctor:URO");
    expect(ids("en", "med-b")[0]).toMatch(/MED-B$/);
  });
  it("offers both the doctor's list and the signals for a unit", () => {
    const r = search(buildEntries("en", [], AS_OF), "urology");
    expect(r.map((x) => x.href)).toEqual(["#doctor?unit=URO", "#research?unit=URO"]);
  });
  it("finds antibiotics by name in both languages and by code", () => {
    expect(ids("en", "siprofloks")).toContain("ab:CIP");
    expect(ids("fi", "ciprofloxacin")).toContain("ab:CIP");
    expect(ids("en", "cip")[0]).toBe("ab:CIP");
    expect(search(buildEntries("en", [], AS_OF), "meropenem")[0]?.href).toBe("#doctor");
  });
  it("finds organisms, including the short forms", () => {
    expect(ids("en", "e. coli")).toContain("org:Escherichia coli");
    expect(ids("en", "ecoli")).toContain("org:Escherichia coli");
    expect(ids("fi", "klebsiella")).toContain("org:Klebsiella oxytoca");
  });
  it("finds phenotypes by code and by their long names", () => {
    expect(search(buildEntries("en", [], AS_OF), "esbl")[0]?.href).toBe("#research?ph=esbl");
    expect(ids("fi", "karbapenemaasi")).toContain("ph:cpe");
    expect(ids("en", "methicillin")).toContain("ph:mrsa");
  });
  it("finds pages in both languages", () => {
    expect(search(buildEntries("fi", [], AS_OF), "map")[0]?.href).toBe("#research?panel=map");
    expect(ids("en", "yksikkokartta")).toContain("page:network");
    expect(ids("en", "asetukset")).toContain("page:settings");
  });
  it("ranks a prefix match before an infix one", () => {
    const r = ids("en", "uro");
    expect(r[0]).toMatch(/URO$/);
    expect(r.indexOf("ab:CXM")).toBeGreaterThan(r.indexOf("doctor:URO"));
  });
  it("puts an exact code match first", () => {
    expect(ids("en", "CIP")[0]).toBe("ab:CIP");
    expect(ids("fi", "ed")[0]).toMatch(/ED$/);
  });
  it("requires every word to match", () => {
    expect(ids("en", "urology cipro")).toEqual([]);
    expect(ids("en", "zzz")).toEqual([]);
  });
  it("shows the newest alerts and the pages for an empty query, at most 8", () => {
    const r = search(buildEntries("en", ALERTS, AS_OF), "");
    expect(r.length).toBeLessThanOrEqual(8);
    expect(r[0]?.group).toBe("alerts");
    expect(r.some((x) => x.group === "pages")).toBe(true);
  });
  it("caps a broad query at 8 results", () => {
    expect(ids("en", "a").length).toBeLessThanOrEqual(8);
  });
});

describe("alerts", () => {
  it("keeps the last 28 days up to the as-of date, one per incident", () => {
    const r = recentAlerts(ALERTS, AS_OF);
    expect(r.map((a) => a.id)).toEqual(["cpe:2"]);
  });
  it("links an alert by its incident, encoded", () => {
    const r = search(buildEntries("en", ALERTS, AS_OF), "cpe");
    const a = r.find((x) => x.group === "alerts");
    expect(a?.href).toBe("#research?inc=cpe%3A1");
    expect(a?.label).toContain("Urology");
    expect(a?.label).toContain("11 May");
  });
  it("offers no alerts without an as-of date", () => {
    expect(buildEntries("en", ALERTS, null).some((e) => e.group === "alerts")).toBe(false);
  });
});
