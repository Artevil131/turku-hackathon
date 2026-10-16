import { formatDate, type Locale, phenotypeName, t } from "@aei/i18n";
import { AsOf } from "../AsOf.tsx";
import type { Changes } from "./changes.ts";

const KIND_KEY = {
  sentinel: "feedKindSentinel",
  cluster: "feedKindCluster",
  trend: "feedKindTrend",
  divergence: "feedKindDivergence",
  data: "feedKindData",
} as const;

interface Props {
  locale: Locale;
  asOf: string | null;
  changes: Changes | null;
  state: "connecting" | "offline" | "ready";
}

/** "What changed since yesterday": counts dated the as-of day, each a link to where it is shown. */
export function Since({ locale, asOf, changes, state }: Props) {
  return (
    <section className="hm-since" aria-labelledby="hm-since-title">
      <header className="hm-since-head">
        <h2 id="hm-since-title">{t(locale, "homeSinceTitle")}</h2>
        {asOf ? <AsOf locale={locale} date={asOf} /> : null}
      </header>
      {state === "connecting" ? (
        <p className="hm-note" role="status" aria-live="polite">
          {t(locale, "homeConnecting")}
        </p>
      ) : null}
      {state === "offline" ? (
        <p className="hm-note hm-offline" role="status">
          {t(locale, "homeOffline")} {t(locale, "homeRetrying")}
        </p>
      ) : null}
      {state === "ready" && changes && changes.total === 0 ? (
        <div className="hm-note">
          <p className="hm-nothing">{t(locale, "homeNothing", { date: formatDate(locale, changes.asOf, "long") })}</p>
          <p className="hm-sub">{t(locale, "homeNothingHint")}</p>
        </div>
      ) : null}
      {state === "ready" && changes && changes.total > 0 ? <Items locale={locale} changes={changes} /> : null}
    </section>
  );
}

function Items({ locale, changes }: { locale: Locale; changes: Changes }) {
  const date = formatDate(locale, changes.asOf, "long");
  return (
    <ul className="hm-items">
      {changes.isolates !== null ? (
        <li className="hm-item">
          <span className="hm-item-label">{t(locale, "homeIsolates")}</span>
          <a className="hm-link" href="#research">
            <span className="visually-hidden">{t(locale, "homeIsolates")}: </span>
            <b className="num">{changes.isolates}</b>
            <span className="hm-date">{date}</span>
          </a>
        </li>
      ) : null}
      <li className="hm-item">
        <span className="hm-item-label">{t(locale, "homeFinds")}</span>
        {changes.finds.length === 0 ? (
          <span className="hm-zero">{t(locale, "homeNone")}</span>
        ) : (
          <span className="hm-links">
            {changes.finds.map((f) => (
              <a key={f.phenotype} className="hm-link" href={`#research?ph=${f.phenotype}`}>
                <b className="num">{f.count}</b>
                <span>{phenotypeName(f.phenotype)}</span>
                <span className="hm-date">{date}</span>
              </a>
            ))}
          </span>
        )}
      </li>
      <li className="hm-item">
        <span className="hm-item-label">{t(locale, "homeAlerts")}</span>
        {changes.alerts.length === 0 ? (
          <span className="hm-zero">{t(locale, "homeNone")}</span>
        ) : (
          <span className="hm-links">
            {changes.alerts.map((a) => (
              <a key={a.kind} className="hm-link" href={`#research?inc=${encodeURIComponent(a.incident)}`}>
                <b className="num">{a.count}</b>
                <span>{t(locale, KIND_KEY[a.kind])}</span>
                <span className="hm-date">{date}</span>
              </a>
            ))}
          </span>
        )}
      </li>
    </ul>
  );
}
