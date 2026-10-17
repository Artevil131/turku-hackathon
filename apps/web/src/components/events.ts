import type { Alert } from "@aei/contract";

// The four planted events (benchmarks/planted-events/README.md) as the tiles of the
// replay timeline's events strip. The date is the first alert a detector actually
// raised for the event; the fallback below is used until such an alert exists.

type EventName = "tlEvN1Name" | "tlEvN2Name" | "tlEvN3Name" | "tlEvN4Name";
type EventWhat = "tlEvN1What" | "tlEvN2What" | "tlEvN3What" | "tlEvN4What";

export interface PlantedEvent {
  code: "E1" | "E2" | "E3" | "E4";
  fallbackDate: string;
  /** Ward code, or null for the hospital-wide trend. */
  unit: string | null;
  name: EventName;
  what: EventWhat;
  matches: (a: Alert) => boolean;
}

export interface ResolvedEvent extends PlantedEvent {
  date: string;
  /** The incident key of the matching alert (`incident ?? id`), null when none fired. */
  incident: string | null;
}

export const PLANTED_EVENTS: readonly PlantedEvent[] = [
  {
    code: "E1",
    fallbackDate: "2025-06-02",
    unit: "URO",
    name: "tlEvN1Name",
    what: "tlEvN1What",
    matches: (a) =>
      a.kind === "detector" &&
      a.ward === "URO" &&
      ((a.detector === "phenotype-excess" && a.phenotype === "esbl") || a.detector === "profile-excess"),
  },
  {
    code: "E2",
    fallbackDate: "2026-03-01",
    unit: "ICU",
    name: "tlEvN2Name",
    what: "tlEvN2What",
    matches: (a) =>
      a.ward === "ICU" &&
      ((a.kind === "new-in-unit" && a.phenotype === "mrsa") ||
        (a.kind === "detector" && a.detector === "phenotype-excess" && a.phenotype === "mrsa")),
  },
  {
    code: "E3",
    fallbackDate: "2025-12-08",
    unit: "PHC-S",
    name: "tlEvN3Name",
    what: "tlEvN3What",
    matches: (a) => a.kind === "detector" && a.ward === "PHC-S" && (a.detector === "sampling-drop" || a.detector === "empty-run"),
  },
  {
    code: "E4",
    fallbackDate: "2026-01-01",
    unit: null,
    name: "tlEvN4Name",
    what: "tlEvN4What",
    matches: (a) => a.kind === "detector" && a.detector === "rising-trend" && a.ward === null,
  },
];

/** Each event with its earliest matching alert's date and incident, else the fallback; sorted by date. */
export function resolveEvents(alerts: readonly Alert[]): ResolvedEvent[] {
  return PLANTED_EVENTS.map((ev): ResolvedEvent => {
    let first: Alert | null = null;
    for (const a of alerts) if (ev.matches(a) && (first === null || a.date < first.date)) first = a;
    return first ? { ...ev, date: first.date, incident: first.incident ?? first.id } : { ...ev, date: ev.fallbackDate, incident: null };
  }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
