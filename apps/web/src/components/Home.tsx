import type { ClockState } from "@aei/contract";
import { PHENOTYPES, shortOrganism } from "@aei/domain";
import { formatDate, type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import type { ReactNode } from "react";
import type { Finding } from "../live.ts";
import { AlertTri, Doctor, Microscope } from "./Icons.tsx";

// The main page: one shared picture of the data, then a choice of role.
// Doctors get recommendations; researchers get the data and plots.

export type Role = "doctor" | "research";

interface Props {
  locale: Locale;
  clock: ClockState | null;
  findings: Finding[];
  lastRole: Role | null;
  onRole: (role: Role) => void;
}

export function Home({ locale, clock, findings, lastRole, onRole }: Props) {
  const asOf = clock?.asOf ?? null;
  const from = asOf ? new Date(Date.parse(`${asOf}T00:00:00Z`) - 28 * 86_400_000).toISOString().slice(0, 10) : null;
  const recent = findings.filter((f) => !from || f.arrivedAt > from);
  const unseen = findings.filter((f) => !f.seen).length;

  return (
    <main className="home">
      <section className="home-intro">
        <h1 className="home-title">{t(locale, "homeTitle")}</h1>
        <p className="home-lead">{t(locale, "homeLead")}</p>
      </section>

      <div className="roles">
        <RoleCard
          kind="doctor"
          icon={<Doctor />}
          title={t(locale, "roleDoctor")}
          lead={t(locale, "roleDoctorLead")}
          points={[t(locale, "roleDoctorP1"), t(locale, "roleDoctorP2"), t(locale, "roleDoctorP3")]}
          action={t(locale, "roleDoctorAction")}
          last={lastRole === "doctor"}
          lastLabel={t(locale, "lastUsed")}
          onRole={onRole}
        />
        <RoleCard
          kind="research"
          icon={<Microscope />}
          title={t(locale, "roleResearch")}
          lead={t(locale, "roleResearchLead")}
          points={[t(locale, "roleResearchP1"), t(locale, "roleResearchP2"), t(locale, "roleResearchP3")]}
          action={t(locale, "roleResearchAction")}
          last={lastRole === "research"}
          lastLabel={t(locale, "lastUsed")}
          onRole={onRole}
        />
      </div>

      <section className="situation glass ply-2" aria-labelledby="situation-title">
        <header className="situation-head">
          <h2 className="situation-title" id="situation-title">
            {t(locale, "situationTitle")}
          </h2>
          <span className="muted num">
            {asOf ? t(locale, "asOf", { date: formatDate(locale, asOf, "long") }) : t(locale, "connecting")}
          </span>
        </header>
        <div className="situation-body">
          <dl className="tallies">
            {PHENOTYPES.map((p) => (
              <div key={p}>
                <dt>{phenotypeName(p)}</dt>
                <dd className="num">{recent.filter((f) => f.phenotype === p).length}</dd>
              </div>
            ))}
            <div>
              <dt>{t(locale, "notSeenYet")}</dt>
              <dd className="num">{unseen}</dd>
            </div>
          </dl>
          <p className="field-hint">{t(locale, "tallyNote")}</p>
          <ul className="latest">
            {recent.slice(0, 4).map((f) => (
              <li key={f.id}>
                <AlertTri />
                <span className="num">{formatDate(locale, f.arrivedAt)}</span>
                <b>{phenotypeName(f.phenotype)}</b>
                <em>{shortOrganism(f.record.organism)}</em>
                <span className="muted">{wardName(locale, f.record.ward)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function RoleCard(props: {
  kind: Role;
  icon: ReactNode;
  title: string;
  lead: string;
  points: string[];
  action: string;
  last: boolean;
  lastLabel: string;
  onRole: (r: Role) => void;
}) {
  return (
    <button type="button" className="role glass ply-2" data-last={props.last} onClick={() => props.onRole(props.kind)}>
      <span className="role-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span className="role-title">
        {props.title}
        {props.last ? <span className="chip">{props.lastLabel}</span> : null}
      </span>
      <span className="role-lead">{props.lead}</span>
      <span className="role-points">
        {props.points.map((p) => (
          <span key={p}>{p}</span>
        ))}
      </span>
      <span className="role-action">{props.action}</span>
    </button>
  );
}
