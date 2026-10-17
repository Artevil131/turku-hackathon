import type { WardCode } from "@aei/domain";
import { type Locale, t, wardName } from "@aei/i18n";
import { AsOf } from "../AsOf.tsx";
import { DEFAULT_UNIT } from "../doctor/filters.ts";
import type { Role } from "../Home.tsx";
import { ArrowRight, Doctor, Microscope } from "../Icons.tsx";

interface Props {
  locale: Locale;
  lastRole: Role | null;
  unit: WardCode | null;
  asOf: string | null;
  /** Open signals in the last 28 days; null while the data is not loaded. */
  signals: number | null;
  onRole: (role: Role) => void;
}

/** The two entries, the last used one first. Both are plain links, so they open in a new tab too. */
export function Roles({ locale, lastRole, unit, asOf, signals, onRole }: Props) {
  const doctor = (
    <RoleLink
      key="doctor"
      kind="doctor"
      last={lastRole === "doctor"}
      lastLabel={t(locale, "homeLast")}
      icon={<Doctor />}
      title={t(locale, "homeDoctor")}
      detail={
        t(locale, "homeDoctorUnit", { unit: wardName(locale, unit ?? DEFAULT_UNIT) }) + (unit ? ` · ${t(locale, "homeUnitStored")}` : "")
      }
      action={t(locale, "homeDoctorOpen")}
      onRole={onRole}
    />
  );
  const research = (
    <RoleLink
      key="research"
      kind="research"
      last={lastRole === "research"}
      lastLabel={t(locale, "homeLast")}
      icon={<Microscope />}
      title={t(locale, "homeResearch")}
      detail={
        signals === null
          ? t(locale, "homeResearchWait")
          : signals === 0
            ? t(locale, "homeResearchNone")
            : signals === 1
              ? t(locale, "homeResearchOne")
              : t(locale, "homeResearchCount", { n: signals })
      }
      asOf={
        signals !== null && asOf ? (
          <>
            <span aria-hidden="true">·</span>
            <AsOf locale={locale} date={asOf} />
          </>
        ) : null
      }
      action={t(locale, "homeResearchOpen")}
      onRole={onRole}
    />
  );
  return (
    <section className="hm-roles" aria-label={t(locale, "homeRoles")}>
      {doctor}
      {research}
    </section>
  );
}

function RoleLink(props: {
  kind: Role;
  last: boolean;
  lastLabel: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  asOf?: React.ReactNode;
  action: string;
  onRole: (r: Role) => void;
}) {
  return (
    <a
      className="hm-role glass"
      data-last={props.last}
      title={props.action}
      href={`#${props.kind}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        props.onRole(props.kind);
      }}
    >
      <span className="hm-role-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span className="hm-role-body">
        <span className="hm-role-title">
          {props.title}
          {props.last ? <span className="chip">{props.lastLabel}</span> : null}
        </span>
        <span className="hm-role-detail">
          <span>{props.detail}</span>
          {props.asOf}
        </span>
      </span>
      <span className="hm-role-action" aria-hidden="true">
        <ArrowRight />
      </span>
    </a>
  );
}
