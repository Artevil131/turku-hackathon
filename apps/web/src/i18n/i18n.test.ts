import { describe, expect, it } from "vitest";
import { alerts } from "./messages/alerts.ts";
import { common } from "./messages/common.ts";
import { report } from "./messages/report.ts";
import { timeline } from "./messages/timeline.ts";
import { treat } from "./messages/treat.ts";
import { formatShare } from "./index.ts";

describe("i18n", () => {
  it("has every key in Finnish and English, with the same placeholders", () => {
    for (const area of [common, treat, alerts, report, timeline]) {
      expect(Object.keys(area.fi).sort()).toEqual(Object.keys(area.en).sort());
      for (const [key, en] of Object.entries(area.en) as [string, string][]) {
        const fi = (area.fi as Record<string, string>)[key] ?? "";
        const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        expect(vars(fi), key).toEqual(vars(en));
      }
    }
  });

  it("has no key in two areas", () => {
    const keys = [common, treat, alerts, report, timeline].flatMap((a) => Object.keys(a.en));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("formatShare", () => {
  it("never reads 100 % unless all, nor 0 % unless none", () => {
    expect(formatShare("en", 293 / 294)).toBe("99%");
    expect(formatShare("en", 1)).toBe("100%");
    expect(formatShare("en", 1 / 300)).toBe("1%");
    expect(formatShare("en", 0)).toBe("0%");
    expect(formatShare("en", 0.873)).toBe("87%");
  });
});
