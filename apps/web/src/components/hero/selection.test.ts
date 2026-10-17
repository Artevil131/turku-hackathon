import type { Alert } from "@aei/contract";
import { describe, expect, it } from "vitest";
import { incidentKey, isKinPill, isSelectedPill, unitOfIncident } from "./selection.ts";

const a = (id: string, incident: string | undefined, ward: string, date = "2025-06-01") =>
  ({ id, incident, ward, date }) as unknown as Alert;

describe("selection", () => {
  it("keys an alert by incident, else id", () => {
    expect(incidentKey(a("x", "inc1", "URO"))).toBe("inc1");
    expect(incidentKey(a("x", undefined, "URO"))).toBe("x");
  });
  it("selects a pill when any member matches", () => {
    const members = [a("1", "i1", "URO"), a("2", "i2", "URO")];
    expect(isSelectedPill(members, "i2")).toBe(true);
    expect(isSelectedPill(members, "i3")).toBe(false);
    expect(isSelectedPill(members, null)).toBe(false);
  });
  it("marks kin in the same unit, never the selected pill", () => {
    const m = [a("1", "i1", "URO")];
    expect(isKinPill(m, "URO" as never, "i2", "URO" as never)).toBe(true);
    expect(isKinPill(m, "URO" as never, "i1", "URO" as never)).toBe(false);
    expect(isKinPill(m, "ED" as never, "i2", "URO" as never)).toBe(false);
    expect(isKinPill(m, "URO" as never, null, null)).toBe(false);
  });
  it("finds the unit of an incident", () => {
    const h = [a("1", "i1", "URO"), a("2", undefined, "ED")];
    expect(unitOfIncident(h, "i1")).toBe("URO");
    expect(unitOfIncident(h, "2")).toBe("ED");
    expect(unitOfIncident(h, "zz")).toBeNull();
  });
});
