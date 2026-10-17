import type { AeiClient } from "@aei/contract";
import type { Project } from "@aei/projects";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BoardState } from "../board.ts";
import { ProjectControls } from "./ProjectControls.tsx";

const board: BoardState = { panel: "geo", weeks: 12, unit: null, kinds: [], phenotype: null, incident: null, focus: null };
const project: Project = {
  id: "study",
  name: "Study",
  description: "",
  mode: "frozen",
  asOf: "2025-05-12",
  createdAt: "2025-05-12",
  updatedAt: "2025-05-12",
  scope: { units: [], organisms: [], phenotypes: [], kinds: [] },
};
const selection = { id: "study", response: { project, drift: true }, failed: false, refresh: vi.fn(), remember: vi.fn() };

describe("project toolbar", () => {
  it("announces the frozen date and changed data, with labelled dialog and menu buttons", () => {
    const html = renderToStaticMarkup(
      <ProjectControls client={{} as AeiClient} locale="en" clock="2025-06-12" board={board} selection={selection} />,
    );
    expect(html).toContain("Frozen at 2025-05-12");
    expect(html).toContain("data changed since freezing");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain(">Project</button>");
    expect(html).toContain(">Export</button>");
  });
  it("provides Finnish copy and leaves export disabled until the clock is known", () => {
    const html = renderToStaticMarkup(
      <ProjectControls client={{} as AeiClient} locale="fi" clock={null} board={board} selection={selection} />,
    );
    expect(html).toContain("Jäädytetty 2025-05-12");
    expect(html).toContain("aineisto muuttunut jäädyttämisen jälkeen");
    expect(html).toMatch(/disabled=""[^>]*>Vie<\/button>/);
  });
});
