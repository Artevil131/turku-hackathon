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
  it("groups by time relative to the clock, newest first, one title and one measure per row", () => {
    const html = render();
    expect(html).toContain("This week · 2");
    expect(html.indexOf("This week · 2")).toBeLessThan(html.indexOf('data-key="recent"'));
    expect(html.indexOf('data-key="recent"')).toBeLessThan(html.indexOf('data-key="priority"'));
    expect(html.indexOf('data-key="priority"')).toBeLessThan(html.indexOf("Earlier · 1"));
    expect(html.indexOf("Earlier · 1")).toBeLessThan(html.indexOf('data-key="history"'));
    expect(html).toContain("Cluster · Escherichia coli · Urology");
    expect(html).toContain("3 patients · usual 0.2");
    // high priority is a dot with the ownership sentence as its tooltip, never a word in the row
    expect(html).toContain('class="feed-dot" title="Inform: infection control and the responsible doctor for Urology"');
    expect(html).not.toContain(">High priority<");
    expect(html).not.toContain("Open incidents");
    // detail waits for the selection
    expect(html).not.toContain("One incident");
  });
  it("shows an active filter as a removable chip and keeps the groups consistent with it", () => {
    const html = render({ ...state, unit: "MED-A" });
    expect(html).not.toContain("feed-filter");
    expect(html).toContain('aria-label="Remove Internal medicine A"');
    expect(html).toContain("Earlier · 1");
    expect(html).not.toContain("This week");
    expect(html).toContain('data-key="history"');
    expect(html).not.toContain('data-key="priority"');
  });
});
