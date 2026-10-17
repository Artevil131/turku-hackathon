import type { RegionalForecast } from "@aei/contract";
import { formatMonth, type Locale, t } from "@aei/i18n";

/** Phenotype totals, deliberately separate from the map's report-group counts. */
export function CountyForecasts({ forecasts, region, locale }: { forecasts: RegionalForecast[]; region: string; locale: Locale }) {
  const rows = forecasts.filter((f) => f.region === region);
  if (rows.length === 0) return null;
  const fmt = (n: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 0 }).format(n);
  return (
    <div className="geo-forecast">
      {rows.map((f) => (
        <p className="geo-card-figs" key={f.phenotype}>
          <strong>{t(locale, "geoForecastTotal", { phenotype: f.phenotype })}</strong>{" "}
          {t(locale, "geoForecastCount", { mean: fmt(f.mean), low: fmt(f.low), high: fmt(f.high) })}{" "}
          <span className="geo-faint">
            ({formatMonth(locale, `${f.month}-01`, true)} · {t(locale, "geoForecastInterval", { level: fmt(f.level * 100) })})
          </span>
        </p>
      ))}
    </div>
  );
}
