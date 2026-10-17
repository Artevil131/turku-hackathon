import { describe, expect, it } from "vitest";
import { parseLayout, serializeLayout, WIN_IDS } from "./layout.ts";
import { nextName, TEMPLATES, templateJson, templateLayout } from "./templates.ts";

describe("project template layouts", () => {
  it.each(TEMPLATES)("builds a complete, parseable %s layout with all windows reachable", (template) => {
    const layout = templateLayout(template);
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
    expect(templateJson(template)).toMatchObject(layout);
    const open = layout.columns.flatMap((column) => column.windows.map((window) => window.id));
    expect(new Set([...open, ...Object.keys(layout.closed)])).toEqual(new Set(WIN_IDS));
  });
  it("opens the outbreak evidence together and keeps blank genuinely blank", () => {
    expect(templateLayout("outbreak").columns.flatMap((c) => c.windows.map((w) => w.id))).toEqual(["signals", "math", "timeline", "graph"]);
    expect(templateLayout("blank").columns).toEqual([]);
    expect(templateLayout("regional").columns.flatMap((c) => c.windows.map((w) => w.id))).toEqual(["timeline", "map"]);
    for (const template of TEMPLATES) expect(templateLayout(template).columns.length).toBeLessThanOrEqual(3);
  });
  it("numbers launched projects after the names already taken", () => {
    const format = (n: number) => `Outbreak investigation ${n}`;
    expect(nextName("Outbreak investigation", [], format)).toBe("Outbreak investigation 1");
    expect(nextName("Outbreak investigation", ["outbreak investigation 1", "Outbreak investigation 3", "Other"], format)).toBe(
      "Outbreak investigation 2",
    );
  });
  it("maximises coverage only when the window is registered", () => {
    const registered = (WIN_IDS as readonly string[]).includes("coverage");
    expect(templateLayout("patient").maximized).toBe(registered ? "coverage" : null);
    expect(templateLayout("antibiogram").columns.map((c) => c.id)).toEqual(registered ? ["grid", "coverage"] : ["grid"]);
  });
});
