import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, t } from "@aei/i18n";
import { describe, expect, it } from "vitest";
import { adaptiveSteps, MAX_STEPS, type OpenWindow, readingOrder } from "./adaptive.ts";
import { GUIDE, GUIDE_KINDS, type GuideKind, kindOfWindow } from "./windowGuide.ts";

const at = (id: string, x: number, y: number): OpenWindow => ({ id, kind: kindOfWindow(id) as GuideKind, x, y });
const says = (open: OpenWindow[]) => adaptiveSteps(open).map((s) => s.say);
const text = (open: OpenWindow[]) => says(open).map((k) => t("en", k as "tourGdIntro"));

describe("kindOfWindow", () => {
  it("reads fixed windows, copies and charts, and rejects the rest", () => {
    expect(kindOfWindow("map")).toBe("map");
    expect(kindOfWindow("win:signals:2")).toBe("signals");
    expect(kindOfWindow("chart:3")).toBe("chart");
    expect(kindOfWindow("nonsense")).toBeNull();
  });
});

describe("adaptiveSteps", () => {
  it("a map-only layout speaks about the map and the timeline, not the notebook", () => {
    // The regional template with the signals closed: the timeline across the top, the map under it.
    const said = text([at("timeline", 0, 0), at("map", 0, 300)]).join(" ");
    expect(said).toMatch(/county/i);
    expect(said).toMatch(/THL/);
    expect(said).not.toMatch(/notebook|write-up/i);
  });

  it("different open sets give different steps", () => {
    const a = says([at("map", 0, 0)]);
    const b = says([at("notebook", 0, 0)]);
    const c = says([at("map", 0, 0), at("notebook", 500, 0)]);
    expect(a).not.toEqual(b);
    expect(c.length).toBeGreaterThanOrEqual(a.length);
    expect(c).toContain("tourGdWhat_notebook");
    expect(c).toContain("tourGdWhat_map");
  });

  it("frames the windows with an intro and an outro", () => {
    const steps = adaptiveSteps([at("grid", 0, 0)]);
    expect(steps[0]?.say).toBe("tourGdIntro");
    expect(steps.at(-1)?.say).toBe("tourGdOutro");
  });

  it("reads top left first, whatever order the DOM holds", () => {
    const open = [at("graph", 700, 0), at("notebook", 0, 400), at("signals", 0, 0), at("map", 350, 6)];
    expect(readingOrder(open).map((w) => w.id)).toEqual(["signals", "map", "graph", "notebook"]);
    const what = says(open).filter((s) => s.startsWith("tourGdWhat_"));
    expect(what).toEqual(["tourGdWhat_signals", "tourGdWhat_map", "tourGdWhat_graph", "tourGdWhat_notebook"]);
  });

  it("mentions a kind once, however many copies are open", () => {
    const open = [at("signals", 0, 0), at("win:signals:2", 400, 0), at("win:signals:3", 800, 0)];
    expect(says(open).filter((s) => s === "tourGdWhat_signals")).toHaveLength(1);
  });

  it("a chart window gets its own entry", () => {
    expect(says([at("chart:1", 0, 0)])).toContain("tourGdWhat_chart");
  });

  it("with no windows it points at the add button", () => {
    const steps = adaptiveSteps([]);
    expect(steps.map((s) => s.say)).toEqual(["tourGdEmpty", "tourGdOutro"]);
    expect(steps[0]?.at).toBe("[data-add-window]");
  });

  it("stays within the step budget with every window open, and still covers the first six", () => {
    const open = GUIDE_KINDS.map((k, i) => at(k === "chart" ? "chart:1" : k, (i % 3) * 400, Math.floor(i / 3) * 300));
    const steps = adaptiveSteps(open);
    expect(steps.length).toBeLessThanOrEqual(MAX_STEPS);
    expect(steps.filter((s) => s.say.startsWith("tourGdWhat_"))).toHaveLength(MAX_STEPS - 2);
  });

  it("points at the real window of each step, copies included", () => {
    const steps = adaptiveSteps([at("win:map:2", 0, 0)]);
    expect(steps[1]?.at).toBe('.ws-win[data-win="win:map:2"]');
    expect(steps[2]?.at).toBe('.ws-win[data-win="win:map:2"] .geo-field select');
  });
});

describe("window guide", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
    });
  const source = files(join(import.meta.dirname, "../.."))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it("covers every kind of window with copy in both languages", () => {
    for (const kind of GUIDE_KINDS) {
      const g = GUIDE[kind];
      expect(g.tries.length).toBeGreaterThanOrEqual(1);
      expect(g.tries.length).toBeLessThanOrEqual(3);
      for (const locale of LOCALES)
        for (const key of [g.title, g.what, ...g.tries.map((a) => a.say)]) expect(t(locale, key), `${locale} ${key}`).not.toBe(key);
    }
  });

  it("only points at class names the components really render", () => {
    for (const kind of GUIDE_KINDS)
      for (const a of GUIDE[kind].tries)
        for (const [, cls] of a.at.matchAll(/\.([\w-]+)/g)) expect(source, `${kind}: .${cls}`).toContain(cls as string);
  });

  it("keeps every caption to two short sentences", () => {
    for (const kind of GUIDE_KINDS)
      for (const key of [GUIDE[kind].what, ...GUIDE[kind].tries.map((a) => a.say)])
        for (const locale of LOCALES) expect(t(locale, key).split(/[.!?] /).length).toBeLessThanOrEqual(2);
  });
});
