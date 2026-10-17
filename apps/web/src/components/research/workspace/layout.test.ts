import { describe, expect, it } from "vitest";
import { COLS, compactLayout, defaultLayout, focusLayout, patchWin, WIN_IDS } from "./layout.ts";

const noOverlap = (l: ReturnType<typeof defaultLayout>) => {
  const open = WIN_IDS.filter((id) => l.wins[id].open).map((id) => l.wins[id]);
  for (const a of open) {
    for (const b of open) {
      if (a === b) continue;
      expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
    }
  }
};

describe("compactLayout", () => {
  it("leaves the default layout alone", () => {
    const l = defaultLayout();
    expect(compactLayout(l).wins).toEqual(l.wins);
  });
  it("floats windows up into a gap", () => {
    const l = patchWin(defaultLayout(), "graph", { open: false });
    expect(compactLayout(l).wins.math.y).toBe(0);
  });
  it("pushes the windows a moved one lands on down, with no overlaps", () => {
    const l = patchWin(defaultLayout(), "assistant", { y: 0 });
    const c = compactLayout(l, "assistant");
    noOverlap(c);
    expect(c.wins.assistant.y).toBe(0);
    expect(c.wins.graph.y).toBeGreaterThanOrEqual(8);
  });
  it("resolves a stored layout that overlaps", () => {
    const l = patchWin(patchWin(defaultLayout(), "graph", { y: 2 }), "math", { y: 0 });
    noOverlap(compactLayout(l));
  });
});

describe("focusLayout", () => {
  it("gives the focused window the whole width and the viewport's rows, and takes the others off the board", () => {
    const d = defaultLayout();
    const f = focusLayout(d, "math", 30);
    expect(f.wins.math).toEqual({ x: 0, y: 0, w: COLS, h: 30, open: true });
    expect(WIN_IDS.filter((id) => f.wins[id].open)).toEqual(["math"]);
    expect(f.order[f.order.length - 1]).toBe("math");
  });
  it("keeps a window taller than the viewport at its own height and leaves the source layout alone", () => {
    const d = defaultLayout();
    const f = focusLayout(d, "signals", 20);
    expect(f.wins.signals.h).toBe(40);
    expect(d.wins.math.open).toBe(true);
    expect(d.wins.signals.w).toBe(3);
  });
});
