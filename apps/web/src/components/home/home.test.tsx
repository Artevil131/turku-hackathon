import type { Alert, ClockState } from "@aei/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Home } from "../Home.tsx";
import { IncidentRow } from "../research/feed/IncidentRow.tsx";
import { groupIncidents, openIncidents } from "../research/feed/model.ts";
import { changesOn, openSignals } from "./changes.ts";
import { Since } from "./Since.tsx";

const weekend: Alert = {
  kind: "detector",
  detector: "phenotype-excess",
  id: "surge",
  incident: "weekend",
  date: "2025-06-07",
  ward: "URO",
  phenotype: "esbl",
  observed: 2,
  expected: 0.3,
};
const related: Alert = { ...weekend, id: "profile", detector: "profile-excess", date: "2025-06-06", observed: 3 };
const clock: ClockState = { asOf: "2025-06-09", start: "2025-01-01", end: "2025-12-31", running: false, tickMs: 1000, daysPerTick: 1 };

describe("returning staff home summary", () => {
  it("keeps a weekend incident visible even when yesterday has no new signal", () => {
    expect(changesOn(clock.asOf, [], [weekend, related], []).alerts).toEqual([]);
    expect(openSignals(clock.asOf, [weekend, related])).toBe(1);
    const html = renderToStaticMarkup(
      <Home
        locale="fi"
        clock={clock}
        findings={[]}
        lastRole={null}
        onRole={() => {}}
        connection="open"
        alerts={[weekend, related]}
        records={[]}
      />,
    );
    expect(html).toContain("Avoimet tapahtumat · 1");
    expect(html).toContain("Yksi tapahtuma · 2 siihen liittyvää hälytystä");
    expect(html).toContain("vastuulääkäri");
    expect(html).toContain('dateTime="2025-06-07"');
    expect(html).toContain('value="7"');
    expect(html).toContain('value="28"');
  });
  it("changes the new-activity window, with inclusive bounds and no future alerts", () => {
    const alerts = [
      weekend,
      related,
      { ...weekend, id: "old", incident: "old", date: "2025-06-02" },
      { ...weekend, id: "future", date: "2025-06-10" },
    ];
    expect(changesOn(clock.asOf, [], alerts, [], 7).alerts[0]?.count).toBe(1);
    expect(changesOn(clock.asOf, [], alerts, [], 28).alerts[0]?.count).toBe(2);
    const html = renderToStaticMarkup(
      <Since
        locale="en"
        asOf={clock.asOf}
        changes={changesOn(clock.asOf, [], alerts, [], 7)}
        state="ready"
        period={7}
        onPeriod={() => {}}
        openCount={2}
      />,
    );
    expect(html).toContain('value="7" selected');
    expect(html).toContain("3.6.2025–9.6.2025");
  });
  it("waits for the alert response instead of presenting an unloaded zero", () => {
    const html = renderToStaticMarkup(<Home locale="en" clock={clock} findings={[]} lastRole={null} onRole={() => {}} connection="open" />);
    expect(html).toContain("Waiting for server");
    expect(html).not.toContain("Open incidents · 0");
  });
  it("counts mixed alert kinds as one incident in the selected period", () => {
    const sentinel: Alert = {
      kind: "new-in-unit",
      id: "sentinel",
      incident: "weekend",
      date: weekend.date,
      ward: "URO",
      phenotype: "mrsa",
      organism: "Staphylococcus aureus",
      patientId: "p1",
      isolateId: "i1",
      previous: null,
    };
    expect(changesOn(clock.asOf, [], [weekend, related, sentinel], [], 7).incidents).toBe(1);
  });
  it("does not show stale counts as current when offline", () => {
    const html = renderToStaticMarkup(
      <Home locale="en" clock={clock} findings={[]} lastRole={null} onRole={() => {}} connection="offline" alerts={[weekend]} />,
    );
    expect(html).toContain("Server not reachable");
    expect(html).not.toContain("Open incidents · 1");
    expect(html).not.toContain('class="feed-row"');
  });
});

describe("incident summaries", () => {
  it("retains all member alerts, but counts one incident and prioritizes its highest severity", () => {
    const incidents = groupIncidents([weekend, related, { ...weekend, id: "newer", incident: "newer", date: "2025-06-09" }]);
    const open = openIncidents(incidents, clock.asOf);
    expect(open.map((i) => i.key)).toEqual(["weekend", "newer"]);
    expect(open[0]?.members).toHaveLength(2);
    const first = open[0];
    if (!first) throw new Error("Expected the weekend incident");
    for (const locale of ["fi", "en"] as const) {
      const html = renderToStaticMarkup(<IncidentRow locale={locale} incident={first} selected spans={null} onSelect={() => {}} />);
      expect(html).toContain(locale === "fi" ? "Yksi tapahtuma · 2" : "One incident · 2");
      expect(html).toContain(locale === "fi" ? "Havaittu 2 potilasta" : "2 patients observed");
      expect(html).toContain('dateTime="2025-06-06"');
      expect(html).toContain('type="button"');
      expect(html).toContain('aria-current="true"');
    }
  });
  it("uses the latest alert for the 28-day open window, including its first day", () => {
    const alerts = [
      weekend,
      related,
      { ...weekend, id: "boundary", incident: "boundary", date: "2025-05-13" },
      { ...weekend, id: "expired", incident: "expired", date: "2025-05-12" },
      { ...weekend, id: "future", incident: "future", date: "2025-06-10" },
    ];
    expect(openIncidents(groupIncidents(alerts), clock.asOf).map((i) => i.key)).toEqual(["weekend", "boundary"]);
  });
});
