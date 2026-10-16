import { type Locale, t } from "@aei/i18n";
import type { ReactNode } from "react";
import { Gear, Mark } from "./Icons.tsx";

export type Page = "home" | "doctor" | "research" | "settings" | "intro";

interface Props {
  locale: Locale;
  page: Page;
  onPage: (p: Page) => void;
  unseen: number;
}

export function TopBar(props: Props) {
  const { locale, page } = props;
  const tab = (p: Page, label: string, extra?: ReactNode) => (
    <button type="button" className="section-tab" aria-current={page === p ? "page" : undefined} onClick={() => props.onPage(p)}>
      {label}
      {extra}
    </button>
  );
  return (
    <header className="topbar glass ply-1">
      <button type="button" className="mark" onClick={() => props.onPage("home")} aria-label={t(locale, "home")}>
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
            <span className="badge num" title={t(locale, "unseenN", { n: props.unseen })}>
              {props.unseen}
            </span>
          ) : null,
        )}
      </nav>

      <div className="top-tools">
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
