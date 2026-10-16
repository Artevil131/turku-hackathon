import { formatDate, type Locale, t } from "@aei/i18n";
import type { ReactNode } from "react";
import { Gear, Mark } from "./Icons.tsx";

export type Page = "home" | "doctor" | "research" | "settings" | "intro";

interface Props {
  locale: Locale;
  page: Page;
  onPage: (p: Page) => void;
  unseen: number;
  /** The replay clock's as-of date, for the badge's label. */
  asOf?: string | null;
  /** Without it the FI/EN switch is left out. */
  onLocale?: (l: Locale) => void;
}

export function TopBar(props: Props) {
  const { locale, page } = props;
  const unseenLabel = t(locale, "unseenFinds", { n: props.unseen, date: props.asOf ? formatDate(locale, props.asOf, "long") : "-" });
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
          props.unseen > 0 ? (
            <span className="badge num" role="img" aria-label={unseenLabel} title={unseenLabel}>
              {props.unseen}
            </span>
          ) : null,
        )}
      </nav>

      <div className="top-tools">
        {props.onLocale ? (
          <button
            type="button"
            className="icon-btn"
            style={{ width: "auto", minWidth: 36, padding: "0 8px", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em" }}
            lang={other}
            onClick={() => props.onLocale?.(other)}
            aria-label={t(locale, "switchLanguage")}
            title={t(locale, "switchLanguage")}
          >
            {other.toUpperCase()}
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
