import { describe, expect, it } from "vitest";
import { parseLayout, serializeLayout, WIN_IDS } from "./layout.ts";
import { TEMPLATES, templateJson, templateLayout } from "./templates.ts";

describe("project template layouts", () => {
  it.each(TEMPLATES)("builds a complete, parseable %s layout with all windows reachable", (template) => {
    const layout = templateLayout(template);
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
    expect(templateJson(template)).toMatchObject(layout);
    const open = layout.columns.flatMap((column) => column.windows.map((window) => window.id));
    expect(new Set([...open, ...Object.keys(layout.closed)])).toEqual(new Set(WIN_IDS));
  });
  it("opens the outbreak evidence together and keeps blank genuinely blank", () => {
    expect(templateLayout("outbreak").columns.flatMap((c) => c.windows.map((w) => w.id))).toEqual(["signals", "math", "graph"]);
    expect(templateLayout("blank").columns).toEqual([]);
    expect(templateLayout("regional").columns.flatMap((c) => c.windows.map((w) => w.id))).toEqual(["map"]);
  });
  it("maximises coverage only when the window is registered", () => {
    const registered = (WIN_IDS as readonly string[]).includes("coverage");
    expect(templateLayout("patient").maximized).toBe(registered ? "coverage" : null);
    expect(templateLayout("antibiogram").columns.map((c) => c.id)).toEqual(registered ? ["grid", "coverage"] : ["grid"]);
  });
});
