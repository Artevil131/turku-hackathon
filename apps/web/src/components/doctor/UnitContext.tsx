import type { AeiClient, CoverageResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { shortOrganism } from "@aei/domain";
import { type Locale, specimenName, t, wardName } from "@aei/i18n";
import { AlertExplanation } from "../AlertExplanation.tsx";
import { AsOf } from "../AsOf.tsx";
import { AlertTri } from "../Icons.tsx";
import { certaintyOf, type DoctorFilters, pct } from "./filters.ts";
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
  onOpenSignals: (ward: WardCode) => void;
}

/** Likely organisms and the unit's own signals: context for the list, never a filter on it. */
export function UnitContext({ client, locale, filters, asOf, data, signals, onOpenSignals }: Props) {
  const wide = useMedia("(min-width: 1100px)");
  const cov = data?.coverage;
  const level = cov ? certaintyOf(cov.level) : null;
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site).toLowerCase();
  const top = cov?.organisms.slice(0, 7) ?? [];
  return (
    <aside className="uc glass ply-2" aria-label={t(locale, "drInUnit")}>
      <details open={wide}>
        <summary>{t(locale, "drInUnit")}</summary>
        <section className="uc-block" aria-labelledby="uc-org">
          <h3 id="uc-org">{t(locale, "drLikely", { specimen: site, unit })}</h3>
          {cov && level ? (
            <p className="uc-sub num">
              <span aria-hidden="true">{level.glyph}</span> {t(locale, level.short)} · {t(locale, "drN", { n: cov.isolates })}{" "}
              {asOf ? <AsOf locale={locale} date={data?.asOf ?? asOf} /> : null}
            </p>
          ) : null}
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
                  {pct(o.share)} % <small>n {o.isolates}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="uc-block" aria-labelledby="uc-sig">
          <h3 id="uc-sig">{t(locale, "drSignals")}</h3>
          {signals.length === 0 ? (
            <p className="uc-sub">{t(locale, "drNoSignals")}</p>
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
