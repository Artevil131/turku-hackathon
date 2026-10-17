import { describe, expect, it } from "vitest";
import { closeTab, patchTab, tabFromHash, tabKey, upsertTab } from "./tabs.ts";

describe("open project tabs", () => {
  it("keys a tab by its project, and every project-less view to one tab", () => {
    expect(tabKey("#project?project=abc&inc=x")).toBe("p:abc");
    expect(tabKey("#project?quick=patient")).toBe("view");
    expect(tabKey("#project")).toBe("view");
    expect(tabFromHash("#project?quick=patient")).toMatchObject({ project: null, quick: "patient" });
    expect(tabFromHash("#project?project=a&quick=patient").quick).toBeNull();
  });
  it("adds a tab once and keeps its name when its view changes", () => {
    let tabs = upsertTab([], "#project?project=a");
    tabs = patchTab(tabs, "p:a", { name: "Study", frozen: true, asOf: "2025-05-12" });
    tabs = upsertTab(tabs, "#project?project=a&unit=URO");
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ name: "Study", frozen: true, hash: "#project?project=a&unit=URO" });
    tabs = upsertTab(tabs, "#project?quick=patient");
    expect(tabs.map((t) => t.key)).toEqual(["p:a", "view"]);
  });
  it("shows the right neighbour after closing, else the left, else nothing", () => {
    const tabs = ["a", "b", "c"].reduce(
      (all, id) => upsertTab(all, `#project?project=${id}`),
      upsertTab([], "#project?project=z").slice(1),
    );
    expect(closeTab(tabs, "p:b").next?.key).toBe("p:c");
    expect(closeTab(tabs, "p:c").next?.key).toBe("p:b");
    expect(closeTab(closeTab(tabs, "p:a").tabs.slice(0, 1), "p:b")).toEqual({ tabs: [], next: null });
    expect(closeTab(tabs, "p:missing").tabs).toHaveLength(3);
  });
});
