import type { AeiClient, CoverageResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { shortOrganism } from "@aei/domain";
import { type Locale, specimenName, t, wardName } from "@aei/i18n";
import { AlertExplanation } from "../AlertExplanation.tsx";
import { AlertTri } from "../Icons.tsx";
import type { ListStatus } from "./CoverageList.tsx";
import { barOf, type DoctorFilters, dmy, droppedFilters, num, pct } from "./filters.ts";
import { Popover } from "./Popover.tsx";
import { signalDate, type UnitSignal } from "./signals.ts";
import "./UnitContext.css";

interface Props {
  client: AeiClient;
  locale: Locale;
  filters: DoctorFilters;
  asOf: string | null;
  data: CoverageResponse | null;
  signals: UnitSignal[];
  /** Status of the coverage fetch that feeds the ladder and the organisms. */
  status: ListStatus;
  onRetry: () => void;
  /** Whether the live alerts behind `signals` have loaded. Optional: derived from `asOf` when absent. */
  alertsStatus?: ListStatus;
  onRetryAlerts?: () => void;
  onOpenSignals: (ward: WardCode) => void;
}

/** Level ladder, likely organisms and the unit's own signals: context for the list, never a filter on it. */
export function UnitContext({
  client,
  locale,
  filters,
  asOf,
  data,
  signals,
  status,
  onRetry,
  alertsStatus,
  onRetryAlerts,
  onOpenSignals,
}: Props) {
  const cov = data?.coverage;
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site).toLowerCase();
  const top = cov?.organisms.slice(0, 7) ?? [];
  const rest = top.length ? Math.max(0, 1 - top.reduce((s, o) => s + o.share, 0)) : 0;
  const orgState: ListStatus = cov ? "ready" : status === "error" ? "error" : "loading";
  const sigState: ListStatus = alertsStatus ?? (asOf ? "ready" : "loading");
  const date = data?.asOf ?? asOf;
  return (
    <>
      {data && droppedFilters(filters, data.coverage).length ? (
        <ul className="uc-ladder">
          {droppedFilters(filters, data.coverage).map((d) => (
            <li key={d.chip} className="uc-chip">
              {t(locale, d.chip, { bar: barOf(data, filters) })}
            </li>
          ))}
        </ul>
      ) : null}
      <section className="uc-block dp-panel" aria-labelledby="uc-org" aria-label={t(locale, "drLikely", { specimen: site, unit })}>
        <h3 id="uc-org" className="uc-title">
          <span>{t(locale, "drOrganisms")}</span>
          {date && cov ? <span className="num uc-date">{dmy(date)}</span> : null}
        </h3>
        {orgState === "loading" ? (
          <Skeleton text={t(locale, "drOrgLoading", { unit })} />
        ) : orgState === "error" ? (
          <Failure text={t(locale, "drOrgError")} retry={t(locale, "drRetry")} onRetry={onRetry} />
        ) : top.length === 0 ? (
          <p className="uc-sub">{t(locale, "drOrgEmpty", { site, date: dmy(date ?? "") })}</p>
        ) : (
          <>
            <div className="uc-stack" aria-hidden="true">
              {top.map((o, i) => (
                <i key={o.organism} style={{ width: `${o.share * 100}%`, background: SHADES[i] }} />
              ))}
              {rest > 0.001 ? <i style={{ width: `${rest * 100}%`, background: "var(--line, #e4e6ee)" }} /> : null}
            </div>
            <ul className="uc-orgs">
              {top.map((o, i) => (
                <li key={o.organism}>
                  <span className="uc-swatch" aria-hidden="true" style={{ background: SHADES[i] }} />
                  <i className="uc-org-name">{shortOrganism(o.organism)}</i>
                  <span className="uc-org-n num">
                    {pct(o.share)}&nbsp;% · n {num(locale, o.isolates)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="uc-block dp-panel" aria-labelledby="uc-sig">
        <h3 id="uc-sig" className="uc-title">
          <span>{t(locale, "drSignals28")}</span>
          {asOf && sigState === "ready" ? <span className="num uc-date">{dmy(asOf)}</span> : null}
          <button type="button" className="link uc-open" onClick={() => onOpenSignals(filters.unit)}>
            {t(locale, "drOpenResearch")}
          </button>
        </h3>
        {sigState === "loading" ? (
          <Skeleton text={t(locale, "drSigLoading")} />
        ) : sigState === "error" ? (
          <Failure text={t(locale, "drSigError")} retry={t(locale, "drRetry")} onRetry={onRetryAlerts} />
        ) : signals.length === 0 ? (
          <p className="uc-sub num">{t(locale, "drSigNone", { date: dmy(asOf ?? "") })}</p>
        ) : (
          <ul className="uc-signals">
            {signals.map((s) => {
              const text = s.feeder
                ? t(locale, "drSignalFeeder", { unit: wardName(locale, s.feeder), label: s.label, date: signalDate(locale, s) })
                : t(locale, "drSignalHere", { label: s.label, date: signalDate(locale, s) });
              return (
                <li key={s.alert.id}>
                  <Popover
                    className="uc-chip uc-sigchip"
                    label={text}
                    title={text}
                    content={
                      <>
                        <p>{text}</p>
                        <AlertExplanation client={client} id={s.alert.id} locale={locale} />
                      </>
                    }
                  >
                    <AlertTri />
                    <span className="uc-sig-text">
                      {s.feeder ? `${wardName(locale, s.feeder)} · ` : ""}
                      {s.label}
                    </span>
                    <span className="num uc-sig-date">{signalDate(locale, s)}</span>
                  </Popover>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/** Seven steps from the navy ink to a pale tint, one per likely organism; the legend rows carry the names. */
const SHADES = [0, 1, 2, 3, 4, 5, 6].map((i) => `color-mix(in srgb, var(--ink-2, #1d204e) ${100 - i * 13}%, #fff)`);

function Skeleton({ text }: { text: string }) {
  return (
    <div className="uc-skel" aria-busy="true">
      <ul aria-hidden="true">
        <li />
        <li />
        <li />
      </ul>
      <p className="uc-sub" role="status">
        {text}
      </p>
    </div>
  );
}

function Failure({ text, retry, onRetry }: { text: string; retry: string; onRetry?: () => void }) {
  return (
    <div className="uc-fail" role="alert">
      <p className="uc-sub">{text}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          {retry}
        </button>
      ) : null}
    </div>
  );
}
