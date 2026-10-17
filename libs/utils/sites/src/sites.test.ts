import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WARDS } from "@aei/domain";
import { ingest } from "@aei/ingest";
import { describe, expect, it } from "vitest";
import { authorize, buildRegistry, parseSitesFile, qualifyResult, qualifyWard, registryFromList, SitesFileError } from "./index.ts";
import { loadSites } from "./node.ts";

const sata = {
  id: "sata",
  fi: "Satasairaala",
  en: "Satasairaala",
  county: "Satakunnan hyvinvointialue",
  token: "sata-secret",
  wards: [
    { code: "ICU", fi: "Teho-osasto", en: "Intensive care unit", type: "in", institution: "hospital" },
    { code: "PKL", fi: "Poliklinikka", en: "Outpatient clinic", type: "out", institution: "hospital" },
  ],
};

const problems = (json: unknown) => {
  try {
    parseSitesFile(json);
    return [];
  } catch (error) {
    if (error instanceof SitesFileError) return error.problems;
    throw error;
  }
};

describe("parseSitesFile", () => {
  it("accepts a valid file and the home site listed only for its token", () => {
    const file = parseSitesFile({ sites: [sata, { id: "tyks", token: "tyks-secret" }] });
    expect(file.sites.map((s) => s.id)).toEqual(["sata", "tyks"]);
    expect(file.sites[1]?.county).toBe("Varsinais-Suomen hyvinvointialue");
  });

  it("lists every problem: duplicate ids and ward codes, missing fields, unknown county", () => {
    const out = problems({
      sites: [
        sata,
        { ...sata, token: "other" },
        { id: "vaasa", fi: "Vaasa", county: "Pohjanmaa", wards: [sata.wards[0], sata.wards[0], { code: "X" }] },
      ],
    });
    expect(out).toContain('site "sata": duplicate id');
    expect(out).toContain('site "vaasa": "en" is required');
    expect(out.some((p) => p.includes('unknown county "Pohjanmaa"'))).toBe(true);
    expect(out).toContain('site "vaasa": duplicate ward code "ICU"');
    expect(out.some((p) => p.includes('wards[2]: "type"'))).toBe(true);
  });

  it("refuses a shared token and a non-array file", () => {
    expect(problems({ sites: [sata, { ...sata, id: "other" }] })).toContain('site "other": same token as site "sata"');
    expect(problems([])).toEqual(['the file must be an object with a "sites" array']);
  });
});

describe("buildRegistry", () => {
  it("is the home site alone without a file", () => {
    const r = buildRegistry();
    expect(r.sites.map((s) => s.id)).toEqual(["tyks"]);
    expect(r.wards).toHaveLength(WARDS.length);
    expect(r.homeHasToken).toBe(false);
  });

  it("gives every site a guide table id, varha unless the entry names one", () => {
    const r = buildRegistry(parseSitesFile({ sites: [{ ...sata, guide: "satakunta" }] }));
    expect(r.site("tyks")?.guide).toBe("varha");
    expect(r.site("sata")?.guide).toBe("satakunta");
    expect(buildRegistry(parseSitesFile({ sites: [sata] })).site("sata")?.guide).toBe("varha");
    expect(problems({ sites: [{ ...sata, guide: "" }] })).toContain('site "sata": "guide" must be a non-empty string');
  });

  it("qualifies a connected site's units and knows the site of every ward", () => {
    const r = buildRegistry(parseSitesFile({ sites: [sata] }));
    expect(r.wardsOf("sata").map((w) => w.code)).toEqual(["sata/ICU", "sata/PKL"]);
    expect(r.ward("sata/PKL")?.type).toBe("out");
    expect(r.siteOfWard("ICU")).toBe("tyks");
    expect(r.siteOfWard("sata/ICU")).toBe("sata");
    expect(r.siteOfWard("sata/UNKNOWN")).toBe("sata");
    expect(qualifyWard("sata", "ICU")).toBe("sata/ICU");
    expect(qualifyWard("sata", "sata/ICU")).toBe("sata/ICU");
    expect(qualifyWard("tyks", "ICU")).toBe("ICU");
  });
});

describe("registryFromList", () => {
  it("rebuilds a site's ward map from the published sites and units", () => {
    const published = buildRegistry(parseSitesFile({ sites: [sata] }));
    const again = registryFromList(published.sites, published.wards);
    expect(again.wardsOf("sata").map((w) => w.code)).toEqual(["sata/ICU", "sata/PKL"]);
    expect(again.connection("sata")?.maps.wards.pkl).toBe("PKL");
    expect(again.connection("sata")?.token).toBeUndefined();
  });
});

describe("authorize", () => {
  const open = buildRegistry(parseSitesFile({ sites: [sata] }));
  const closed = buildRegistry(parseSitesFile({ sites: [sata, { id: "tyks", token: "tyks-secret" }] }));

  it("maps a token to its site and no token to the home site", () => {
    expect(authorize(open, "Bearer sata-secret")).toMatchObject({ ok: true, site: { site: { id: "sata" } } });
    expect(authorize(open, undefined)).toMatchObject({ ok: true, site: { site: { id: "tyks" } } });
  });

  it("refuses an unknown token, and no token once the home site has one", () => {
    expect(authorize(open, "Bearer nope")).toMatchObject({ ok: false, status: 401 });
    expect(authorize(open, "Basic abc")).toMatchObject({ ok: false, status: 401 });
    expect(authorize(closed, undefined)).toMatchObject({ ok: false, status: 401 });
    expect(authorize(closed, "Bearer tyks-secret")).toMatchObject({ ok: true, site: { site: { id: "tyks" } } });
  });
});

describe("qualifyResult", () => {
  const r = buildRegistry(parseSitesFile({ sites: [sata] }));
  const site = r.connection("sata");
  const csv = (ward: string) =>
    `patient_id,sex,birth_year,culture_id,sample_date,ward,specimen,organism,CIP\nP1,F,1950,C-${ward},2025-06-02,${ward},urine,E. coli,S\n`;

  it("qualifies a registered unit and takes its type from the site", () => {
    if (!site) throw new Error("no site");
    const parsed = ingest(csv("PKL"), "csv", { maps: site.maps });
    const { result, unregistered } = qualifyResult(parsed, site);
    expect(result.cultures[0]).toMatchObject({ ward: "sata/PKL", wardType: "out" });
    expect(unregistered).toEqual([]);
  });

  it("keeps an unregistered unit, qualified, with a warning", () => {
    if (!site) throw new Error("no site");
    const parsed = ingest(csv("CARD"), "csv", { maps: site.maps });
    const { result, unregistered } = qualifyResult(parsed, site);
    expect(result.cultures[0]?.ward).toBe("sata/CARD");
    expect(unregistered).toEqual(["sata/CARD"]);
    expect(result.warnings.some((w) => w.includes("not registered"))).toBe(true);
  });

  it("does not map another site's unit names", () => {
    if (!site) throw new Error("no site");
    // "Urologia" is a Tyks unit name; for Satasairaala it is just an unregistered code.
    const parsed = ingest(csv("Urologia"), "csv", { maps: site.maps });
    expect(qualifyResult(parsed, site).result.cultures[0]?.ward).toBe("sata/Urologia");
  });
});

describe("loadSites", () => {
  it("reads code maps relative to the file and notes a readable token file", () => {
    const dir = mkdtempSync(join(tmpdir(), "aei-sites-"));
    writeFileSync(join(dir, "sata-codes.json"), JSON.stringify({ wards: { "4410": "ICU" } }));
    writeFileSync(join(dir, "sites.json"), JSON.stringify({ sites: [{ ...sata, codeMap: "sata-codes.json" }] }), { mode: 0o644 });
    const { registry, notes } = loadSites(join(dir, "sites.json"));
    expect(registry.connection("sata")?.maps.wards["4410"]).toBe("ICU");
    expect(notes[0]).toContain("chmod 600");
  });

  it("stops on a missing code map", () => {
    const dir = mkdtempSync(join(tmpdir(), "aei-sites-"));
    writeFileSync(join(dir, "sites.json"), JSON.stringify({ sites: [{ ...sata, codeMap: "missing.json" }] }));
    expect(() => loadSites(join(dir, "sites.json"))).toThrow(SitesFileError);
  });
});
