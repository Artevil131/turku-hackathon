import { type Locale, phenotypeName, t } from "@aei/i18n";
import { AsOf } from "../AsOf.tsx";
import type { Changes } from "./changes.ts";

interface Props {
  locale: Locale;
  asOf: string | null;
  changes: Changes | null;
  state: "connecting" | "offline" | "ready";
}

/** "Since yesterday": three numbers dated the as-of day (once, in the header), each a link to where it is shown. */
export function Since({ locale, asOf, changes, state }: Props) {
  return (
    <section className="hm-since glass" aria-labelledby="hm-since-title">
      <header className="hm-head">
        <h1 id="hm-since-title">{t(locale, "homeSinceTitle")}</h1>
        {(asOf ?? changes?.asOf) ? <AsOf locale={locale} date={(asOf ?? changes?.asOf) as string} /> : null}
      </header>
      {state === "connecting" ? (
        <p className="hm-note" role="status" aria-live="polite">
          {t(locale, "homeConnecting")}
        </p>
      ) : null}
      {state === "offline" ? (
        <p className="hm-note hm-offline" role="status">
          {t(locale, "homeOffline")}
        </p>
      ) : null}
      {state === "ready" && changes ? <Stats locale={locale} changes={changes} /> : null}
    </section>
  );
}

function Stats({ locale, changes }: { locale: Locale; changes: Changes }) {
  const finds = changes.finds.reduce((n, f) => n + f.count, 0);
  const signals = changes.alerts.reduce((n, a) => n + a.count, 0);
  const firstFind = changes.finds[0];
  const firstAlert = changes.alerts[0];
  const stats: { key: string; label: string; n: number; href: string; title?: string }[] = [];
  if (changes.isolates !== null) stats.push({ key: "isolates", label: t(locale, "homeIsolates"), n: changes.isolates, href: "#research" });
  stats.push({
    key: "finds",
    label: t(locale, "homeFinds"),
    n: finds,
    href: firstFind ? `#research?ph=${firstFind.phenotype}` : "#research",
    title: changes.finds.map((f) => `${phenotypeName(f.phenotype)} ${f.count}`).join(" · ") || undefined,
  });
  stats.push({
    key: "signals",
    label: t(locale, "homeAlerts"),
    n: signals,
    href: firstAlert ? `#research?inc=${encodeURIComponent(firstAlert.incident)}` : "#research",
  });
  return (
    <ul className="hm-stats">
      {stats.map((s) => (
        <li key={s.key}>
          <a className="hm-stat" href={s.href} data-zero={s.n === 0} title={s.title}>
            <b className="hm-n">{s.n}</b>
            <span className="hm-label">{s.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
