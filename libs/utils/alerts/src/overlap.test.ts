import { describe, expect, it } from "vitest";
import { patientOverlap } from "./overlap.ts";

const patients = (...ids: string[]) => ids.map((patientId) => ({ patientId }));

describe("incident patient overlap", () => {
  it("shows when seven patients include the four in the cluster", () => {
    expect(patientOverlap(patients("a", "b", "c", "d"), patients("a", "b", "c", "d", "e", "f", "g"))).toEqual({
      both: 4,
      onlyAbove: 0,
      onlyRelated: 3,
    });
  });
  it("counts a patient once, not their isolates", () => {
    expect(patientOverlap(patients("a", "a", "b"), patients("a", "a", "c"))).toEqual({ both: 1, onlyAbove: 1, onlyRelated: 1 });
  });
  it("handles identical, disjoint and empty groups", () => {
    expect(patientOverlap(patients("a"), patients("a"))).toEqual({ both: 1, onlyAbove: 0, onlyRelated: 0 });
    expect(patientOverlap(patients("a"), patients("b"))).toEqual({ both: 0, onlyAbove: 1, onlyRelated: 1 });
    expect(patientOverlap([], [])).toEqual({ both: 0, onlyAbove: 0, onlyRelated: 0 });
  });
});
