import { describe, expect, it } from "vitest";
import { episodeOf, groupEpisodes } from "./episodes.ts";
import type { Signal } from "./types.ts";
import { visibleSignals } from "./visible.ts";

// Hand-made signals: codes here are test data, not app logic.
const sig = (p: Partial<Signal> & { id: string }): Signal => ({
  kind: "cluster",
  severity: "medium",
  firstDate: "2025-06-01",
  lastDate: "2025-06-10",
  ward: "W1",
  observed: 3,
  isolateIds: [],
  ...p,
});

describe("episodes: one outbreak, one card", () => {
  const cluster = sig({ id: "c", kind: "cluster", severity: "high", organism: "Org a", phenotype: "xyz", firstDate: "2025-06-04" });
  const surge = sig({ id: "s", kind: "surge", severity: "high", phenotype: "xyz", firstDate: "2025-06-07" });
  const shift = sig({ id: "f", kind: "shift", organism: "Org a", antibiotic: "A1", firstDate: "2025-06-10", lastDate: "2025-06-20" });
  const otherUnit = sig({ id: "o", kind: "shift", ward: "W2", organism: "Org a", firstDate: "2025-06-10" });
  const otherBug = sig({ id: "b", kind: "shift", organism: "Org b", firstDate: "2025-06-10" });
  const gap = sig({ id: "g", kind: "data-gap", organism: undefined, firstDate: "2025-06-05" });
  const later = sig({ id: "l", kind: "shift", organism: "Org a", firstDate: "2025-09-01", lastDate: "2025-09-05" });
  const hospital = sig({ id: "h", kind: "trend", ward: null, organism: "Org a", firstDate: "2025-06-01" });

  it("links signals on one unit with the same organism or flag, close in time; leads with the most severe, earliest", () => {
    const eps = groupEpisodes([shift, surge, cluster, otherUnit, otherBug, gap, later, hospital]);
    const big = eps.find((e) => e.members.length === 3)!;
    expect(big.members.map((s) => s.id)).toEqual(["c", "s", "f"]); // oldest first
    expect(big.lead.id).toBe("c");
    expect(big.severity).toBe("high");
    expect(big.id).toBe("ep|c");
    expect(big.lastDate).toBe("2025-06-20");
    // Another unit, another organism, a data gap, months later or hospital-wide: separate.
    expect(eps).toHaveLength(6);
    expect(episodeOf(eps, "f")).toBe(big);
  });

  it("keeps the order of the list it is given", () => {
    const eps = groupEpisodes([otherBug, shift, cluster]);
    expect(eps.map((e) => e.lead.id)).toEqual(["b", "c"]);
  });

  it("never shows a signal before it started, nor drawn past the day shown", () => {
    const out = visibleSignals(
      [sig({ id: "a", firstDate: "2025-06-01", lastDate: "2025-06-30" }), sig({ id: "z", firstDate: "2025-07-01" })],
      "2025-06-15",
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.lastDate).toBe("2025-06-15");
  });
});
