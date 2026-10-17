import type { AeiClient, CoverageResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { shortOrganism } from "@aei/domain";
import { formatDate, type Locale, specimenName, t, wardName } from "@aei/i18n";
import { AlertExplanation } from "../AlertExplanation.tsx";
import { AsOf } from "../AsOf.tsx";
import { AlertTri } from "../Icons.tsx";
import type { ListStatus } from "./CoverageList.tsx";
import { certaintyOf, type DoctorFilters, num, pct } from "./filters.ts";
import { signalDate, type UnitSignal } from "./signals.ts";
import { useMedia } from "./useMedia.ts";
import "./UnitContext.css";

interface Props {
  client: AeiClient;
  locale: Locale;
  filters: DoctorFilters;
  asOf: string | null;
  data: CoverageResponse | null;
  signals: UnitSignal[];
  /** Status of the coverage fetch that feeds the organisms rail. */
  status: ListStatus;
  onRetry: () => void;
  /** Whether the live alerts behind `signals` have loaded. Optional: App does not pass it yet, so it is derived from `asOf`. */
  alertsStatus?: ListStatus;
  onRetryAlerts?: () => void;
  onOpenSignals: (ward: WardCode) => void;
}

/** Likely organisms and the unit's own signals: context for the list, never a filter on it. */
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
  const wide = useMedia("(min-width: 1100px)");
  const cov = data?.coverage;
  const level = cov ? certaintyOf(cov.level) : null;
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site).toLowerCase();
  const top = cov?.organisms.slice(0, 7) ?? [];
  const orgState: "loading" | "error" | "ready" = cov ? "ready" : status === "error" ? "error" : "loading";
  const sigState: ListStatus = alertsStatus ?? (asOf ? "ready" : "loading");
  const sigDate = asOf ? formatDate(locale, asOf, "long") : "";
  return (
    <aside className="uc glass ply-2" aria-label={t(locale, "drInUnit")}>
      <details open={wide}>
        <summary>{t(locale, "drInUnit")}</summary>
        <section className="uc-block" aria-labelledby="uc-org">
          <h3 id="uc-org" className="uc-title">
            <span>{t(locale, "drLikely", { specimen: site, unit })}</span>
            {cov && asOf ? <AsOf locale={locale} date={data?.asOf ?? asOf} /> : null}
          </h3>
          {orgState === "ready" && cov && level ? (
            <p className="uc-sub num">
              <span aria-hidden="true">{level.glyph}</span> {t(locale, level.short)} · {t(locale, "drN", { n: num(locale, cov.isolates) })}
            </p>
          ) : null}
          {orgState === "loading" ? (
            <Skeleton text={t(locale, "drOrgLoading", { unit })} />
          ) : orgState === "error" ? (
            <Failure text={t(locale, "drOrgError")} retry={t(locale, "drRetry")} onRetry={onRetry} />
          ) : top.length === 0 ? (
            <p className="uc-sub">{t(locale, "drOrgEmpty", { site, date: formatDate(locale, data?.asOf ?? asOf ?? "", "long") })}</p>
          ) : (
            <ul className="uc-orgs">
              {top.map((o) => (
                <li key={o.organism}>
                  <span className="uc-org-name">
                    <i>{shortOrganism(o.organism)}</i>
                  </span>
                  <span className="uc-org-bar" aria-hidden="true">
                    <b style={{ width: `${o.share * 100}%` }} />
                  </span>
                  <span className="uc-org-n num">
                    {pct(o.share)} % <small>{t(locale, "drN", { n: num(locale, o.isolates) })}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="uc-block" aria-labelledby="uc-sig">
          <h3 id="uc-sig" className="uc-title">
            <span>{t(locale, "drSignals")}</span>
            {asOf && sigState === "ready" ? <AsOf locale={locale} date={asOf} /> : null}
          </h3>
          {sigState === "loading" ? (
            <Skeleton text={t(locale, "drSigLoading")} />
          ) : sigState === "error" ? (
            <Failure text={t(locale, "drSigError")} retry={t(locale, "drRetry")} onRetry={onRetryAlerts} />
          ) : signals.length === 0 ? (
            <p className="uc-sub">{t(locale, "drNoSignals", { date: sigDate })}</p>
          ) : (
            <ul className="uc-signals">
              {signals.map((s) => (
                <li key={s.alert.id}>
                  <span className="uc-sig-line">
                    <AlertTri />{" "}
                    <span>
                      {s.feeder ? `${wardName(locale, s.feeder)} · ` : ""}
                      {s.label} · <span className="num">{signalDate(locale, s)}</span>
                    </span>
                  </span>
                  <AlertExplanation client={client} id={s.alert.id} locale={locale} />
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn" onClick={() => onOpenSignals(filters.unit)}>
            {t(locale, "drOpenResearch")}
          </button>
        </section>
      </details>
    </aside>
  );
}

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
