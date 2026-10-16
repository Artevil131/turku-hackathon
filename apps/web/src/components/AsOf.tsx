import { formatDate, type Locale, t } from "@aei/i18n";

interface Props {
  locale: Locale;
  /** The panel's own fetched as-of date, i.e. its last update. */
  date: string;
  /** True while the panel's date differs from the clock's; `clockDate` is then shown as the target. */
  pending?: boolean;
  clockDate?: string;
}

/** "as of 12 May 2025", plus "updating to ..." while the panel lags the clock. */
export function AsOf({ locale, date, pending, clockDate }: Props) {
  return (
    <span className="asof">
      {t(locale, "asOfShort", { date: formatDate(locale, date, "long") })}
      {pending && clockDate ? ` · ${t(locale, "asOfUpdating", { date: formatDate(locale, clockDate, "long") })}` : null}
    </span>
  );
}
