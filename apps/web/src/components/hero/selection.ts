import type { Alert } from "@aei/contract";
import type { WardCode } from "@aei/domain";

// Which pills the selected incident lights (spec research-unified 2.1): the incident key is
// `alert.incident ?? alert.id`, and a pill may stand for several alerts.

export const incidentKey = (a: Pick<Alert, "id" | "incident">): string => a.incident ?? a.id;

/** The pill (its members) is the selected signal when any member belongs to the selected incident. */
export const isSelectedPill = (members: readonly Pick<Alert, "id" | "incident">[], selected: string | null | undefined): boolean =>
  selected != null && members.some((m) => incidentKey(m) === selected);

/** Another appearance in the same unit as the selected incident: a quiet mark, never on the selected pill. */
export const isKinPill = (
  members: readonly Pick<Alert, "id" | "incident">[],
  ward: WardCode | null | undefined,
  selected: string | null | undefined,
  selectedUnit: WardCode | null | undefined,
): boolean => selected != null && selectedUnit != null && ward === selectedUnit && !isSelectedPill(members, selected);

/** The unit of the alert that carries the selected incident key (the newest one), if the history holds it. */
export function unitOfIncident(alerts: readonly Alert[], key: string | null | undefined): WardCode | null {
  if (key == null) return null;
  let found: Alert | undefined;
  for (const a of alerts) if (incidentKey(a) === key && (!found || a.date >= found.date)) found = a;
  return found?.ward ?? null;
}
