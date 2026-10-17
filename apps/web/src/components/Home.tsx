import type { Alert, ClockState } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { useMemo, useState } from "react";
import type { Connection, Finding } from "../live.ts";
import { readStoredUnit } from "./doctor/filters.ts";
import { changesOn } from "./home/changes.ts";
import { Latest, latestSignal } from "./home/Latest.tsx";
import { Roles } from "./home/Roles.tsx";
import { Since } from "./home/Since.tsx";
import { IncidentRow } from "./research/feed/IncidentRow.tsx";
import { groupIncidents, openIncidents } from "./research/feed/model.ts";
import "./home/home.css";
import "./research/SignalFeed.css";

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
  const [period, setPeriod] = useState<1 | 7 | 28>(1);
  const changes = useMemo(
    () => (asOf && alerts ? changesOn(asOf, findings, alerts, records, period) : null),
    [asOf, findings, alerts, records, period],
  );
  const open = useMemo(
    () => (asOf && alerts ? openIncidents(groupIncidents(alerts.filter((a) => a.date <= asOf)), asOf) : []),
    [asOf, alerts],
  );
  const signals = asOf && alerts && connection !== "offline" ? open.length : null;
  const latest = asOf && alerts && connection !== "offline" ? latestSignal(asOf, alerts) : null;
  const state = connection === "offline" ? "offline" : asOf === null || alerts === undefined ? "connecting" : "ready";

  return (
    <div className="hm">
      <Since locale={locale} asOf={asOf} changes={changes} state={state} period={period} onPeriod={setPeriod} openCount={signals} />
      {latest ? <Latest locale={locale} alert={latest} /> : null}
      {state === "ready" && signals !== null && open.length > 0 ? (
        <section className="hm-incidents glass" aria-label={t(locale, "feedOpen", { n: open.length })}>
          <ul className="feed-list">
            {open.map((incident) => (
              <li key={incident.key}>
                <IncidentRow
                  locale={locale}
                  incident={incident}
                  spans={null}
                  selected={false}
                  onSelect={(key) => {
                    window.location.hash = `research?inc=${encodeURIComponent(key)}`;
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Roles locale={locale} lastRole={lastRole} unit={unit} asOf={asOf} signals={signals} onRole={onRole} />
    </div>
  );
}
