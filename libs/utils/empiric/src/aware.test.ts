import { describe, expect, it } from "vitest";
import { awareOf } from "./aware.ts";

describe("awareOf", () => {
  it("classifies by English name, any case and combination spelling", () => {
    expect(awareOf({ code: "X1", en: "ampicillin" })).toBe("access");
    expect(awareOf({ code: "X2", en: "Nitrofurantoin" })).toBe("access");
    expect(awareOf({ code: "X3", en: "piperacillin-tazobactam" })).toBe("watch");
    expect(awareOf({ code: "X4", en: "Piperacillin / Tazobactam" })).toBe("watch");
    expect(awareOf({ code: "X5", en: "amoxicillin-clavulanic acid" })).toBe("access");
    expect(awareOf({ code: "X6", en: "trimethoprim + sulfamethoxazole" })).toBe("access");
    expect(awareOf({ code: "X7", en: "meropenem" })).toBe("watch");
    expect(awareOf({ code: "X8", en: "ceftazidime-avibactam" })).toBe("reserve");
    expect(awareOf({ code: "X9", en: "colistin" })).toBe("reserve");
  });

  it("ignores parenthesised notes", () => {
    expect(awareOf({ code: "X", en: "cefoxitin (screen)" })).toBe("watch");
  });

  it("falls back to the WHONET code when the name is not recognised", () => {
    expect(awareOf({ code: "nit", en: "Furadantin" })).toBe("access");
    expect(awareOf({ code: "MEM", en: "Meronem" })).toBe("watch");
  });

  it("gives no group to an unknown antibiotic", () => {
    expect(awareOf({ code: "ZZZ", en: "examplomycin" })).toBeNull();
    // Route-dependent groups are deliberately not listed.
    expect(awareOf({ code: "Q1", en: "fosfomycin" })).toBeNull();
  });
});
