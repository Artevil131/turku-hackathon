import type { Alert } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import type { ReactNode } from "react";
import { CommandField } from "./command/CommandField.tsx";
import { openSignals } from "./home/changes.ts";
import { Gear, Mark } from "./Icons.tsx";

export type Page = "home" | "doctor" | "research" | "settings" | "intro";

interface Props {
  locale: Locale;
  page: Page;
  onPage: (p: Page) => void;
  /** No longer used: the badge counts open signals itself, from `alerts`. */
  unseen?: number;
  /** The replay clock's as-of date, for the badge's label. */
  asOf?: string | null;
  /** Without it the FI/EN switch is left out. */
  onLocale?: (l: Locale) => void;
  /** The released alerts the app holds, for the search field; without them it offers none. */
  alerts?: readonly Alert[];
}

export function TopBar(props: Props) {
  const { locale, page } = props;
  // One quantity, the same as the home card: distinct open signals of the last 28 days up to the as-of date.
  const signals = props.asOf && props.alerts ? openSignals(props.asOf, [...props.alerts]) : 0;
  const unseenLabel = t(locale, signals === 1 ? "unseenFindsOne" : "unseenFinds", {
    n: signals,
    date: props.asOf ? formatDate(locale, props.asOf, "long") : "-",
  });
  const other: Locale = locale === "fi" ? "en" : "fi";
  const tab = (p: Page, label: string, extra?: ReactNode) => (
    <button type="button" className="section-tab" aria-current={page === p ? "page" : undefined} onClick={() => props.onPage(p)}>
      {label}
      {extra}
    </button>
  );
  return (
    <header className="topbar glass ply-1">
      <button type="button" className="mark" onClick={() => props.onPage("home")} title={t(locale, "home")}>
        <Mark className="mark-glyph" />
        <span>
          <span className="mark-name">{t(locale, "appName")}</span>
          <span className="mark-sub">{t(locale, "appTagline")}</span>
        </span>
      </button>

      <nav className="sections" aria-label={t(locale, "sections")}>
        {tab("home", t(locale, "home"))}
        {tab("doctor", t(locale, "roleDoctor"))}
        {tab(
          "research",
          t(locale, "roleResearch"),
          signals > 0 ? (
            <span className="badge num" role="img" aria-label={unseenLabel} title={unseenLabel}>
              {signals}
            </span>
          ) : null,
        )}
      </nav>

      <div className="top-tools">
        <CommandField locale={locale} alerts={props.alerts} asOf={props.asOf ?? null} />
        {props.onLocale ? (
          <button
            type="button"
            className="icon-btn"
            style={{ width: "auto", minWidth: 36, padding: "0 8px", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em" }}
            lang={other}
            onClick={() => props.onLocale?.(other)}
            title={t(locale, "switchLanguage")}
          >
            {other.toUpperCase()}
            <span className="visually-hidden"> · {t(locale, "switchLanguage")}</span>
          </button>
        ) : null}
        <button
          type="button"
          className="icon-btn"
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => props.onPage("settings")}
          aria-label={t(locale, "settings")}
          title={t(locale, "settings")}
        >
          <Gear />
        </button>
      </div>
    </header>
  );
}
