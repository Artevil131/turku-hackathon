import type { RegionalForecast, RegionalSignal } from "@aei/contract";
import { formatMonth, type Locale, t } from "@aei/i18n";
import type { ReactNode, Ref } from "react";
import { CountyForecasts } from "./CountyForecasts.tsx";

/** Replaces the map in its tile, rather than opening below its visible bounds. */
export function CountyDetail({
  region,
  signal,
  groupLabel,
  forecasts,
  locale,
  onClose,
  headingRef,
  children,
}: {
  region: string;
  signal: RegionalSignal | null;
  groupLabel: string;
  forecasts: RegionalForecast[];
  locale: Locale;
  onClose: () => void;
  headingRef: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}) {
  const fmt = (n: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 }).format(n);
  return (
    <section className="geo-detail" aria-labelledby="geo-county-title" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <header className="geo-detail-head">
        <h3 id="geo-county-title" className="geo-title" tabIndex={-1} ref={headingRef}>
          {t(locale, "geoCountyDetail", { region: region.replace(/ hyvinvointialue$/, "") })}
        </h3>
        <button type="button" className="geo-chip" onClick={onClose}>
          {t(locale, "geoBackToMap")}
        </button>
      </header>
      <div className="geo-detail-body">
        <h4 className="geo-h3">{t(locale, "geoStrongestSignal")}</h4>
        {signal ? (
          <>
            <p className="geo-card-figs">
              {groupLabel} · {formatMonth(locale, `${signal.month}-01`, true)}
            </p>
            <p className="geo-card-figs">
              {t(locale, "mapSignalDetail", { cases: signal.cases, expected: fmt(signal.expected), p: signal.p.toExponential(2) })}
            </p>
            <p className="geo-faint">{t(locale, signal.strong ? "geoDetailStrong" : "geoDetailWeak")}</p>
          </>
        ) : (
          <p className="geo-faint">{t(locale, "mapFocusNoSignal")}</p>
        )}
        <h4 className="geo-h3">{t(locale, "geoDetailForecast")}</h4>
        <CountyForecasts forecasts={forecasts} region={region} locale={locale} />
        {!forecasts.some((f) => f.region === region) ? <p className="geo-faint">{t(locale, "geoForecastUnavailable")}</p> : null}
        <p className="geo-faint">{t(locale, "geoVreNoForecast")}</p>
        <p className="geo-faint">{t(locale, "geoForecastNote")}</p>
        <p className="geo-faint">{t(locale, "geoForecastCaveat")}</p>
        {children}
      </div>
    </section>
  );
}
