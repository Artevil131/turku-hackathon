import type { Alert } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import type { ReactNode } from "react";
import { CommandField } from "./command/CommandField.tsx";
import { openSignals } from "./home/changes.ts";
import { Gear, Plug } from "./Icons.tsx";
import { SitePicker } from "./SitePicker.tsx";

export type Page = "home" | "doctor" | "research" | "method" | "connect" | "settings" | "intro";

interface Props {
  projectName?: string | null;
  locale: Locale;
  page: Page;
  onPage: (p: Page) => void;
  /** No longer used: the badge counts open signals itself, from `alerts`. */
  unseen?: number;
  /** The replay clock's as-of date, for the badge's label. */
  asOf?: string | null;
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
  const tab = (p: Page, label: string, extra?: ReactNode) => (
    <button type="button" className="section-tab" aria-current={page === p ? "page" : undefined} onClick={() => props.onPage(p)}>
      {label}
      {extra}
    </button>
  );
  return (
    <header className="topbar glass">
      <button type="button" className="mark" onClick={() => props.onPage("home")} title={t(locale, "home")}>
        <span className="mark-name">{t(locale, "appName")}</span>
      </button>

      <nav className="sections" aria-label={t(locale, "sections")}>
        {tab("home", t(locale, "startProjects"))}
        {tab(
          "research",
          props.projectName ?? t(locale, "startWorkspace"),
          signals > 0 ? (
            <span className="badge num" role="img" aria-label={unseenLabel} title={unseenLabel}>
              {signals}
            </span>
          ) : null,
        )}
        {tab("method", t(locale, "methodNav"))}
        <button
          type="button"
          className="section-tab section-tab-connect"
          aria-current={page === "connect" ? "page" : undefined}
          onClick={() => props.onPage("connect")}
        >
          <Plug />
          {t(locale, "connectNav")}
        </button>
      </nav>

      <div className="top-tools">
        <SitePicker locale={locale} compact />
        <CommandField locale={locale} alerts={props.alerts} asOf={props.asOf ?? null} />
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
