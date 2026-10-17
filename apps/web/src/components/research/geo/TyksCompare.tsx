import type { WeeklyResponse } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { addDaysIso, phenotypeOfSeries, phenotypeWindows } from "@aei/viz";
import { currentHospitalName } from "../../../sites.ts";
import "./geo.css";

/** For Varsinais-Suomi's county detail only. The caller supplies clock-current /api/weekly data. */
export function TyksCompare({ weekly, group, locale }: { weekly: WeeklyResponse; group: string; locale: Locale }) {
  const phenotype = phenotypeOfSeries(group);
  const windows = phenotype ? phenotypeWindows(weekly, phenotype) : null;
  const endOf = (start: string) => {
    const end = addDaysIso(start, 6);
    return end > weekly.asOf ? weekly.asOf : end;
  };
  const partial = windows !== null && addDaysIso(windows.recent.to, 6) > weekly.asOf;
  const number = (n: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB").format(n);

  return (
    <section
      className="tyks-compare"
      aria-label={t(locale, "tyksCompareTitle", { phenotype: phenotype?.toUpperCase() ?? "—", hospital: currentHospitalName(locale) })}
    >
      <h3>{t(locale, "tyksCompareTitle", { phenotype: phenotype?.toUpperCase() ?? "—", hospital: currentHospitalName(locale) })}</h3>
      <p className="geo-faint">{t(locale, "tyksCompareSynthetic")}</p>
      {windows ? (
        <dl>
          {(["previous", "recent"] as const).map((key) => (
            <div key={key}>
              <dt>{t(locale, key === "recent" ? "tyksCompareRecent" : "tyksComparePrevious")}</dt>
              <dd>
                <strong>{number(windows[key].count)}</strong>
                <span className="geo-faint">
                  {formatDate(locale, windows[key].from)}–{formatDate(locale, endOf(windows[key].to))}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="geo-faint">{t(locale, phenotype ? "tyksCompareMissing" : "tyksCompareUnknown")}</p>
      )}
      {partial ? <p className="geo-faint">{t(locale, "tyksComparePartial", { date: formatDate(locale, weekly.asOf) })}</p> : null}
      <p className="geo-faint">{t(locale, "tyksCompareCounting")}</p>
      <p className="geo-faint">{t(locale, "tyksCompareCaution")}</p>
    </section>
  );
}
