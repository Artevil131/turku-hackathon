import { formatDate, type Locale, t } from "@aei/i18n";
import { IncidentRow } from "./feed/IncidentRow.tsx";
import type { Incident } from "./feed/model.ts";
import type { Spans } from "./feed/spans.ts";
import "./SignalFeed.css";

// Past signals: what was found before this month, newest first, by month. The Signals window keeps the present
// (this week, this month); this one is the record. A row opens the same evidence card in the Signals window.

const LOCALE_TAG: Record<Locale, string> = { fi: "fi-FI", en: "en-GB" };

export function HistoryFeed({
  locale,
  incidents,
  asOf,
  selected,
  spansOf,
  onSelect,
}: {
  locale: Locale;
  /** The incidents older than the Signals window shows, newest first. */
  incidents: readonly Incident[];
  asOf: string | null;
  selected: string | null;
  spansOf: (i: Incident) => Spans | null;
  onSelect: (key: string) => void;
}) {
  const months = new Map<string, Incident[]>();
  for (const i of incidents) {
    const key = i.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), i]);
  }
  const monthName = (key: string) =>
    new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: "long", year: "numeric" }).format(new Date(`${key}-01T00:00:00Z`));
  return (
    <section className="feed history" aria-labelledby="history-title">
      <header className="feed-header">
        <div className="feed-headline">
          <h1 id="history-title">{t(locale, "historyTitle")}</h1>
          {asOf ? <span className="asof">{formatDate(locale, asOf)}</span> : null}
        </div>
      </header>
      <div className="feed-body">
        {incidents.length === 0 ? (
          <p className="feed-state" role="status">
            {t(locale, "historyEmpty")}
          </p>
        ) : (
          [...months.entries()].map(([key, list]) => {
            const title = `${monthName(key)} · ${list.length}`;
            return (
              <section key={key} className="feed-group" aria-label={title}>
                <h2 className="feed-group-title">{title}</h2>
                <ul className="feed-list">
                  {list.map((i) => (
                    <li key={i.key}>
                      <IncidentRow locale={locale} incident={i} selected={selected === i.key} spans={spansOf(i)} onSelect={onSelect} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
