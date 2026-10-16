import type { Result } from "@aei/feed";
import { describe, expect, it } from "vitest";
import { firstIsolates, firstPositions, indexResults, windowRange } from "./counting.ts";

let seq = 0;
function iso(over: Partial<Result>): Result {
  seq++;
  return {
    isolateId: `I${String(seq).padStart(5, "0")}`,
    cultureId: `C${seq}`,
    patientId: "P1",
    sampleDate: "2026-03-01",
    admissionDate: null,
    ward: "W1",
    specimen: "urine",
    organism: "Org A",
    sex: "F",
    ageYears: 50,
    phenotypes: [],
    results: {},
    ...over,
  };
}

const ids = (rs: readonly Result[]) => rs.map((r) => r.isolateId);

describe("firstIsolates", () => {
  it("keeps the earliest isolate per patient, organism and specimen", () => {
    const later = iso({ sampleDate: "2026-03-05" });
    const first = iso({ sampleDate: "2026-03-02" });
    const otherSpecimen = iso({ sampleDate: "2026-03-04", specimen: "blood" });
    const otherOrganism = iso({ sampleDate: "2026-03-04", organism: "Org B" });
    const otherPatient = iso({ sampleDate: "2026-03-06", patientId: "P2" });
    const out = firstIsolates([later, first, otherSpecimen, otherOrganism, otherPatient], null, null);
    // In time order; the two 03-04 isolates by isolate id.
    expect(ids(out)).toEqual(ids([first, otherSpecimen, otherOrganism, otherPatient]));
    expect(out).not.toContain(later);
  });

  it("breaks same-day ties by isolate id", () => {
    const b = iso({ isolateId: "Z-2", sampleDate: "2026-03-02" });
    const a = iso({ isolateId: "Z-1", sampleDate: "2026-03-02" });
    expect(ids(firstIsolates([b, a], null, null))).toEqual(["Z-1"]);
  });

  it("uses (from, to]: from exclusive, to inclusive", () => {
    const onFrom = iso({ patientId: "A", sampleDate: "2026-03-01" });
    const after = iso({ patientId: "B", sampleDate: "2026-03-02" });
    const onTo = iso({ patientId: "C", sampleDate: "2026-03-10" });
    const late = iso({ patientId: "D", sampleDate: "2026-03-11" });
    expect(ids(firstIsolates([onFrom, after, onTo, late], "2026-03-01", "2026-03-10"))).toEqual(ids([after, onTo]));
  });

  it("de-duplicates within the window only (a repeat counts when its first isolate is older)", () => {
    const old = iso({ sampleDate: "2026-01-10" });
    const repeat = iso({ sampleDate: "2026-03-05" });
    expect(ids(firstIsolates([old, repeat], "2026-02-10", "2026-03-10"))).toEqual(ids([repeat]));
  });

  it("applies the filter before de-duplication", () => {
    const elsewhere = iso({ sampleDate: "2026-03-02", ward: "W2" });
    const here = iso({ sampleDate: "2026-03-05", ward: "W1" });
    expect(ids(firstIsolates([elsewhere, here], null, null, (r) => r.ward === "W1"))).toEqual(ids([here]));
  });
});

describe("result index", () => {
  function fixture(): Result[] {
    const out: Result[] = [];
    const wards = ["W1", "W2", "W3"];
    const organisms = ["Org A", "Org B"];
    const specimens = ["urine", "blood"];
    let x = 7;
    const rand = (n: number) => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x % n;
    };
    for (let i = 0; i < 400; i++) {
      out.push(
        iso({
          patientId: `P${rand(40)}`,
          sampleDate: `2026-0${1 + rand(3)}-${String(1 + rand(28)).padStart(2, "0")}`,
          ward: wards[rand(3)]!,
          organism: organisms[rand(2)]!,
          specimen: specimens[rand(2)]!,
        }),
      );
    }
    return out;
  }

  it("agrees with firstIsolates for any window and filter, unsorted input included", () => {
    const results = fixture();
    const index = indexResults(results);
    for (const [from, to] of [
      [null, null],
      ["2026-01-15", "2026-02-20"],
      ["2026-02-28", "2026-03-28"],
      ["2026-04-01", null],
    ] as const) {
      for (const ward of ["W1", "W2", null]) {
        const plain = firstIsolates(results, from, to, (r) => ward === null || r.ward === ward);
        const fast = firstPositions(index, from, to, (i) => ward === null || index.sorted[i]!.ward === ward).map((i) => index.sorted[i]!);
        expect(ids(fast)).toEqual(ids(plain));
      }
    }
  });

  it("finds window bounds by binary search", () => {
    const results = fixture();
    const index = indexResults(results);
    const [lo, hi] = windowRange(index, "2026-02-01", "2026-02-15");
    const inside = index.sorted.filter((r) => r.sampleDate > "2026-02-01" && r.sampleDate <= "2026-02-15");
    expect(index.sorted.slice(lo, hi)).toEqual(inside);
  });

  it("is cached per array and extends itself when results are appended", () => {
    const all = fixture().sort((a, b) =>
      a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : a.isolateId < b.isolateId ? -1 : 1,
    );
    const firstHalf = all.filter((r) => r.sampleDate <= "2026-02-14");
    const day = all.filter((r) => r.sampleDate > "2026-02-14" && r.sampleDate <= "2026-02-15");
    const base = indexResults(firstHalf);
    expect(indexResults(firstHalf)).toBe(base);
    const grown = [...firstHalf, ...day];
    const extended = indexResults(grown);
    expect(extended.sorted).toEqual(grown);
    const plain = firstIsolates(grown, null, null);
    expect(ids(firstPositions(extended, null, null).map((i) => extended.sorted[i]!))).toEqual(ids(plain));
    // The earlier index is untouched.
    expect(base.sorted.length).toBe(firstHalf.length);
    // Results pushed onto an already indexed array are noticed.
    const pushed = [...firstHalf];
    expect(indexResults(pushed).sorted.length).toBe(firstHalf.length);
    pushed.push(...day);
    expect(ids(indexResults(pushed).sorted)).toEqual(ids(grown));
    // A different array (not an extension) is indexed from scratch, correctly.
    const shuffled = [...grown].reverse();
    const rebuilt = indexResults(shuffled);
    expect(ids(rebuilt.sorted)).toEqual(ids(grown));
  });
});
