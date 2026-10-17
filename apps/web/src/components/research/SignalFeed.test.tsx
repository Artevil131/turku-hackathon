import { type Alert, createAeiClient } from "@aei/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BoardState } from "./board.ts";
import { groupIncidents } from "./feed/model.ts";
import { SignalFeed } from "./SignalFeed.tsx";

const state: BoardState = { panel: "geo", weeks: 12, unit: null, kinds: [], phenotype: null, incident: null, focus: null };
const client = createAeiClient({ baseUrl: "http://localhost" });
const alerts: Alert[] = [
  {
    kind: "detector",
    detector: "phenotype-excess",
    id: "recent",
    date: "2025-06-09",
    ward: "URO",
    phenotype: "esbl",
    observed: 2,
    expected: 0.3,
  },
  {
    kind: "detector",
    detector: "profile-excess",
    id: "priority",
    date: "2025-06-07",
    ward: "URO",
    organism: "Escherichia coli",
    observed: 3,
    expected: 0.2,
  },
  {
    kind: "detector",
    detector: "phenotype-excess",
    id: "history",
    date: "2025-04-01",
    ward: "MED-A",
    phenotype: "esbl",
    observed: 2,
    expected: 0.1,
  },
];

function render(filters = state) {
  return renderToStaticMarkup(
    <SignalFeed
      client={client}
      locale="en"
      asOf="2025-06-09"
      state={filters}
      onChange={() => {}}
      reducedMotion
      findings={[]}
      acknowledge={() => {}}
      load={{ status: "ready", asOf: "2025-06-09", alerts }}
      incidents={groupIncidents(alerts)}
      retry={() => {}}
      spansOf={() => null}
      selected={null}
    />,
  );
}

describe("research incident feed", () => {
  it("opens with priority-sorted open incidents and keeps older incidents below them", () => {
    const html = render();
    expect(html).toContain("Open incidents · 2");
    expect(html.indexOf('data-key="priority"')).toBeLessThan(html.indexOf('data-key="recent"'));
    expect(html.indexOf('data-key="recent"')).toBeLessThan(html.indexOf("Earlier incidents"));
    expect(html.indexOf("Earlier incidents")).toBeLessThan(html.indexOf('data-key="history"'));
    expect(html).toContain("Escherichia coli");
    expect(html).toContain("Urology");
    expect(html).toContain("3 patients observed · expected 0.2");
    expect(html).toContain("responsible doctor");
  });
  it("keeps the open summary consistent with unit filters", () => {
    const html = render({ ...state, unit: "MED-A" });
    expect(html).toContain("Open incidents · 0");
    expect(html).toContain('data-key="history"');
    expect(html).not.toContain('data-key="priority"');
  });
});
