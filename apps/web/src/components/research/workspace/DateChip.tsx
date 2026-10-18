import { formatDate, type Locale, t } from "@aei/i18n";

// The data's "today", always in view: the replay clock's day (D-005), or the day a frozen project stands at.
// A chip in the toolbar shows the date and whether it moves; open, it is a month with that day marked, the days
// after it muted (no results have arrived for them yet), and one sentence on what the date means here.

const LOCALE_TAG: Record<Locale, string> = { fi: "fi-FI", en: "en-GB" };

/** The month grid around `iso`: six weeks from the Monday on or before the 1st. */
function monthGrid(iso: string): { year: number; month: number; cells: (number | null)[] } {
  const [y = 2025, m = 1] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return { year: y, month: m, cells };
}

export function DateChip({ locale, date, frozen }: { locale: Locale; date: string | null; frozen: boolean }) {
  if (!date) return null;
  const tag = LOCALE_TAG[locale];
  const { year, month, cells } = monthGrid(date);
  const day = Number(date.slice(8, 10));
  const monthName = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag, { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <details className="ws-date">
      <summary className="ws-date-chip" title={t(locale, "wsDateTitle")}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <rect x="1.5" y="2.5" width="13" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1.5 6.5h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <b>{formatDate(locale, date, "long")}</b>
        <span className="ws-date-tag" data-frozen={frozen || undefined}>
          {t(locale, frozen ? "wsDateFrozenTag" : "wsDateLiveTag")}
        </span>
      </summary>
      <div className="ws-date-pop" role="dialog" aria-label={t(locale, "wsDateTitle")}>
        <p className="ws-date-head">{t(locale, "wsDateTitle")}</p>
        <p className="ws-date-big">{formatDate(locale, date, "long")}</p>
        <p className="ws-date-why">
          {t(locale, frozen ? "wsDateFrozen" : "wsDateLive", {
            date: formatDate(locale, date, "long"),
            today: formatDate(locale, today, "long"),
          })}
        </p>
        <div className="ws-cal" role="group" aria-label={monthName}>
          <p className="ws-cal-month">{monthName}</p>
          <div className="ws-cal-grid">
            {weekdays.map((w) => (
              <span key={w} className="ws-cal-wd">
                {w}
              </span>
            ))}
            {cells.map((d, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the grid's cells never reorder
                key={i}
                className="ws-cal-day"
                data-today={d === day || undefined}
                data-future={d !== null && d > day ? "" : undefined}
                aria-current={d === day ? "date" : undefined}
              >
                {d ?? ""}
              </span>
            ))}
          </div>
          <p className="ws-cal-note">{t(locale, "wsDateFutureNote")}</p>
        </div>
      </div>
    </details>
  );
}
