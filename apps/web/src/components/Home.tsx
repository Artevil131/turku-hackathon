import type { Alert, ClockState } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { useMemo } from "react";
import type { Connection, Finding } from "../live.ts";
import { readStoredUnit } from "./doctor/filters.ts";
import { changesOn, openSignals } from "./home/changes.ts";
import { Roles } from "./home/Roles.tsx";
import { Since } from "./home/Since.tsx";
import "./home/home.css";

// The home page: what changed since yesterday, then the two roles. Every
// number comes from the live data and carries its as-of date.

export type Role = "doctor" | "research";

interface Props {
  locale: Locale;
  clock: ClockState | null;
  findings: Finding[];
  lastRole: Role | null;
  onRole: (role: Role) => void;
  /** Optional additions; without them the matching numbers are left out, never guessed. */
  connection?: Connection;
  alerts?: Alert[];
  records?: IsolateRecord[];
}

export function Home({ locale, clock, findings, lastRole, onRole, connection, alerts, records }: Props) {
  const asOf = clock?.asOf ?? null;
  const unit = useMemo(() => readStoredUnit(), []);
  const changes = useMemo(() => (asOf && alerts ? changesOn(asOf, findings, alerts, records) : null), [asOf, findings, alerts, records]);
  const signals = asOf && alerts && connection !== "offline" ? openSignals(asOf, alerts) : null;
  const state = asOf === null ? (connection === "offline" ? "offline" : "connecting") : connection === "offline" ? "offline" : "ready";

  return (
    <div className="hm">
      <Since locale={locale} asOf={asOf} changes={changes} state={state} />
      <Roles locale={locale} lastRole={lastRole} unit={unit} asOf={asOf} signals={signals} onRole={onRole} />
    </div>
  );
}
