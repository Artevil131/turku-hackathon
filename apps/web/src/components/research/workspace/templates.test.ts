import { describe, expect, it } from "vitest";
import { parseLayout, serializeLayout, WIN_IDS } from "./layout.ts";
import { nextName, TEMPLATES, templateJson, templateLayout } from "./templates.ts";

const openIds = (template: (typeof TEMPLATES)[number]) => WIN_IDS.filter((id) => templateLayout(template).wins[id].open);

describe("project template layouts", () => {
  it.each(TEMPLATES)("builds a parseable %s layout that keeps every window reachable", (template) => {
    const layout = templateLayout(template);
    expect(parseLayout(serializeLayout(layout))).not.toBeNull();
    expect(templateJson(template)).toMatchObject({ v: 3 });
    expect(Object.keys(layout.wins).sort()).toEqual([...WIN_IDS].sort());
  });
  it("opens the outbreak evidence together and keeps blank genuinely blank", () => {
    expect(openIds("outbreak")).toEqual(["signals", "graph", "math"]);
    expect(openIds("blank")).toEqual([]);
    expect(openIds("regional")).toEqual(["map"]);
  });
  it("opens coverage for the patient and antibiogram templates", () => {
    expect(openIds("patient")).toEqual(["coverage"]);
    expect(openIds("antibiogram")).toEqual(["grid", "coverage"]);
  });
  it("numbers launched projects after the names already taken", () => {
    const format = (n: number) => `Outbreak investigation ${n}`;
    expect(nextName("Outbreak investigation", [], format)).toBe("Outbreak investigation 1");
    expect(nextName("Outbreak investigation", ["outbreak investigation 1", "Outbreak investigation 3", "Other"], format)).toBe(
      "Outbreak investigation 2",
    );
  });
});
