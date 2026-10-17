import type { AeiClient } from "@aei/contract";
import type { Project } from "@aei/projects";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../shell/Sidebar.tsx";
import type { BoardState } from "../board.ts";
import { ExportFormatButtons } from "./ExportMenu.tsx";
import { ProjectActions } from "./ProjectActions.tsx";

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
const selection = { id: "study", response: { project, drift: true }, failed: false, missing: false, refresh: vi.fn(), remember: vi.fn() };
const noop = () => {};

describe("project actions in the sidebar", () => {
  it("offers the recommended research package first in both locales and disables formats while building", () => {
    for (const [locale, label] of [
      ["en", "Research package (.zip) — recommended"],
      ["fi", "Tutkimuspaketti (.zip) — suositeltu"],
    ] as const) {
      const html = renderToStaticMarkup(<ExportFormatButtons locale={locale} busy={true} onSelect={vi.fn()} />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain(`role="menuitem" disabled="">${label}</button>`);
      expect(html.indexOf(label)).toBeLessThan(html.indexOf(">CSV</button>"));
      expect(html.match(/disabled=""/g)).toHaveLength(9);
    }
  });
  it("names the Project and Export menus as menu buttons", () => {
    const html = renderToStaticMarkup(
      <ProjectActions client={{} as AeiClient} locale="en" clock="2025-06-12" board={board} selection={selection} onReproduce={vi.fn()} />,
    );
    expect(html).toMatch(/id="pm-project"[^>]*aria-haspopup="menu"/);
    expect(html).toMatch(/id="pm-export"[^>]*aria-haspopup="menu"/);
    expect(html).toContain(">Project</span>");
    expect(html).toContain(">Export</span>");
    expect(html).toContain(">Share…</span>");
  });
  it("enables Reproduce and Share only for a saved project", () => {
    const props = { client: {} as AeiClient, locale: "en" as const, clock: "2025-06-12", board, onReproduce: vi.fn() };
    expect(renderToStaticMarkup(<ProjectActions {...props} selection={selection} />)).toMatch(
      /<button type="button" class="sb-item" data-open-reproduce="true" title="Reproduce">/,
    );
    const none = renderToStaticMarkup(<ProjectActions {...props} selection={{ ...selection, id: null, response: null }} />);
    expect(none).toMatch(/data-open-reproduce="true" disabled=""/);
    expect(none).toMatch(/data-share="true" disabled=""/);
  });
  it("provides Finnish copy and leaves export disabled until the clock is known", () => {
    const html = renderToStaticMarkup(
      <ProjectActions client={{} as AeiClient} locale="fi" clock={null} board={board} selection={selection} />,
    );
    expect(html).toMatch(/id="pm-export"[^>]*disabled=""/);
    expect(html).toContain(">Vie</span>");
  });
  it("marks a frozen project in its sidebar entry, with changed data", () => {
    const tab = {
      key: "p:study",
      project: "study",
      quick: null,
      name: "Study",
      frozen: true,
      asOf: "2025-05-12",
      drift: true,
      hash: "#project?project=study",
    };
    for (const [locale, frozen, drift] of [
      ["en", "Frozen at 2025-05-12", "data changed since freezing"],
      ["fi", "Jäädytetty 2025-05-12", "aineisto muuttunut jäädyttämisen jälkeen"],
    ] as const) {
      const html = renderToStaticMarkup(
        <Sidebar
          locale={locale}
          page="project"
          tabs={[tab]}
          activeKey="p:study"
          collapsed={false}
          drawer={false}
          onDrawer={noop}
          onCollapsed={noop}
          onHome={noop}
          onTab={noop}
          onCloseTab={noop}
          onNew={noop}
          onDemo={noop}
          onTour={noop}
          onLocale={noop}
          onPage={noop}
          setActionsSlot={noop}
          setWindowsSlot={noop}
        />,
      );
      expect(html).toContain(frozen);
      expect(html).toContain(drift);
      expect(html).toContain('aria-current="page"');
    }
  });
});
