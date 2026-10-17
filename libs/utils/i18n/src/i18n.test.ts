import { describe, expect, it } from "vitest";
import { en } from "./en.ts";
import { fi } from "./fi.ts";
import { alertPriority, antibioticName, registerSites, registerWards, siteName, t, wardName } from "./index.ts";

describe("i18n", () => {
  it("has a Finnish string for every English key", () => {
    expect(Object.keys(fi).sort()).toEqual(Object.keys(en).sort());
  });

  it("fills placeholders", () => {
    expect(t("en", "thinData", { n: 12, min: 30 })).toContain("12");
  });

  it("uses the dataset's own names", () => {
    expect(wardName("fi", "ICU")).toBe("Teho-osasto");
    expect(antibioticName("en", "TZP")).toBe("piperacillin-tazobactam");
  });

  it("names a connected site's units once registered, and falls back to the bare code", () => {
    expect(wardName("en", "sata/ICU")).toBe("ICU");
    registerWards([{ code: "sata/ICU", site: "sata", fi: "Teho (Sata)", en: "ICU (Sata)", type: "in", institution: "hospital" }]);
    expect(wardName("en", "sata/ICU")).toBe("ICU (Sata)");
    expect(wardName("fi", "ICU")).toBe("Teho-osasto");
    expect(alertPriority({ kind: "new-in-unit", ward: "sata/ICU", date: "2025-06-01" })).toBe("high");
    registerSites([{ id: "sata", fi: "Satasairaala", en: "Satasairaala", county: "Satakunnan hyvinvointialue" }]);
    expect(siteName("fi", "sata")).toBe("Satasairaala");
    expect(siteName("fi", "tyks")).toBe("Tyks");
    registerWards([]);
  });
});
