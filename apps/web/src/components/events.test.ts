import type { Alert } from "@aei/contract";
import { describe, expect, it } from "vitest";
import { resolveEvents } from "./events.ts";

const detector = (over: Partial<Extract<Alert, { kind: "detector" }>>): Alert =>
  ({ kind: "detector", id: "d", date: "2025-01-01", ward: null, detector: "rising-trend", observed: 1, ...over }) as Alert;

describe("resolveEvents", () => {
  const alerts: Alert[] = [
    detector({ id: "late", date: "2025-06-20", ward: "URO", detector: "phenotype-excess", phenotype: "esbl" }),
    detector({ id: "early", date: "2025-06-09", ward: "URO", detector: "phenotype-excess", phenotype: "esbl", incident: "inc-1" }),
    detector({ id: "other", date: "2025-06-01", ward: "URO", detector: "phenotype-excess", phenotype: "mrsa" }),
    detector({ id: "trend", date: "2026-02-01", detector: "rising-trend" }),
  ];

  it("takes the earliest matching alert and its incident key", () => {
    const e1 = resolveEvents(alerts).find((e) => e.code === "E1");
    expect(e1).toMatchObject({ date: "2025-06-09", incident: "inc-1" });
    expect(resolveEvents(alerts).find((e) => e.code === "E4")).toMatchObject({ date: "2026-02-01", incident: "trend" });
  });

  it("ignores a matching alert from before the event's window (the ICU had an MRSA in January 2025)", () => {
    const earlyIcu = { kind: "new-in-unit", id: "icu-old", date: "2025-01-19", ward: "ICU", phenotype: "mrsa" } as unknown as Alert;
    const lateIcu = { kind: "new-in-unit", id: "icu-new", date: "2026-03-03", ward: "ICU", phenotype: "mrsa" } as unknown as Alert;
    expect(resolveEvents([earlyIcu]).find((e) => e.code === "E2")).toMatchObject({ date: "2026-03-03", incident: null });
    expect(resolveEvents([earlyIcu, lateIcu]).find((e) => e.code === "E2")).toMatchObject({ date: "2026-03-03", incident: "icu-new" });
  });

  it("falls back to the planted date with no incident", () => {
    expect(resolveEvents(alerts).find((e) => e.code === "E3")).toMatchObject({ date: "2025-12-15", incident: null });
  });

  it("sorts by date", () => {
    expect(resolveEvents(alerts).map((e) => e.code)).toEqual(["E1", "E3", "E4", "E2"]);
    expect(resolveEvents([]).map((e) => e.code)).toEqual(["E1", "E3", "E4", "E2"]);
  });
});
