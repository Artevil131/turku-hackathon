import { describe, expect, it } from "vitest";
import { en } from "./en.ts";
import { fi } from "./fi.ts";
import { antibioticName, t, wardName } from "./index.ts";

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
});
