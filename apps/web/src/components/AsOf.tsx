import { formatDate, formatDateNumeric, type Locale, t } from "@aei/i18n";

interface Props {
  locale: Locale;
  /** The panel's own fetched as-of date, i.e. its last update. */
  date: string;
  /** True while the panel's date differs from the clock's; `clockDate` is then shown as the target. */
  pending?: boolean;
  clockDate?: string;
}

/** The panel's as-of date, date only (12.5.2025), in the display face; "→ date" while it lags the clock. */
export function AsOf({ locale, date, pending, clockDate }: Props) {
  const full = t(locale, "asOfShort", { date: formatDate(locale, date, "long") });
  return (
    <span className="asof" title={full}>
      <span className="visually-hidden">{full}</span>
      <span aria-hidden="true">{formatDateNumeric(date)}</span>
      {pending && clockDate ? (
        <span className="asof-next" title={t(locale, "asOfUpdating", { date: formatDate(locale, clockDate, "long") })}>
          {" → "}
          {formatDateNumeric(clockDate)}
        </span>
      ) : null}
    </span>
  );
}
