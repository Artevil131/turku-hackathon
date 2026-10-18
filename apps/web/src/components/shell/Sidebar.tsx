import { type Locale, t } from "@aei/i18n";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { DEMOS, type DemoSpec } from "../../demo/demos.ts";
import { copy } from "../../demo/fillCopy.ts";
import type { DocTab } from "../../shell/tabs.ts";
import { useMedia } from "../doctor/useMedia.ts";
import { Gear } from "../Icons.tsx";
import { SitePicker } from "../SitePicker.tsx";
import { PHONE } from "./Menu.tsx";
import "./shell.css";

export type ShellPage = "home" | "project" | "data" | "settings" | "docs";

const Svg = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const HOME = "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z";
const DATA = "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3ZM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5";
const BOOK = "M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14.5H6.5A1.5 1.5 0 0 0 5 20ZM5 20a1.5 1.5 0 0 0 1.5 1.5H19M9 8h6";
const SEARCH = "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20";
const GLOBE = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c-2.8 2.6-2.8 15.4 0 18M12 3c2.8 2.6 2.8 15.4 0 18";
/** The two languages, each named in itself. */
const LANGS: readonly [Locale, string, string][] = [
  ["fi", "FI", "Suomi"],
  ["en", "EN", "English"],
];
const DOC = "M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5ZM14 3.5V8h4";
const VIEW = "M3.5 12S6.5 6 12 6s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";
const FROZEN = "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5";
const PLUS = "M12 5v14M5 12h14";
const PLAY = "M8 5.5v13l10.5-6.5z";
const REPLAY = "M4.5 12a7.5 7.5 0 1 0 2.4-5.5L4.5 8.5M4.5 4v4.5H9";
const DEMO = "M5 4.5h10l4 4v11h-14zM15 4.5v4h4M8.5 13h7M8.5 16h5";

/** Opens the command palette (the search over units, antibiotics, signals and pages). */
export function openSearch() {
  dispatchEvent(new CustomEvent("aei:command"));
}

export function tabName(locale: Locale, tab: DocTab): string {
  if (tab.name) return tab.name;
  if (tab.project) return "…";
  return tab.quick === "patient" ? t(locale, "startPatient") : t(locale, "shellUntitled");
}

/**
 * The app's one navigation (no top bar): Home, the open projects, the open project's own actions (filled
 * through slots by the project view), Data, then search and Settings at the foot. Collapses to an icon rail;
 * on a phone it is a drawer behind the menu button.
 */
export function Sidebar({
  locale,
  page,
  tabs,
  activeKey,
  collapsed,
  drawer,
  onDrawer,
  onCollapsed,
  onHome,
  onTab,
  onCloseTab,
  onNew,
  onDemo,
  onTour,
  onPage,
  onLocale,
  setActionsSlot,
  setWindowsSlot,
}: {
  locale: Locale;
  page: ShellPage;
  tabs: readonly DocTab[];
  activeKey: string | null;
  collapsed: boolean;
  drawer: boolean;
  onDrawer: (open: boolean) => void;
  onCollapsed: (value: boolean) => void;
  onHome: () => void;
  onTab: (tab: DocTab) => void;
  onCloseTab: (tab: DocTab) => void;
  onNew: () => void;
  /** Opens a demo file (creating its project the first time). */
  onDemo: (demo: DemoSpec, replay?: boolean) => void;
  /** Starts the full presentation. */
  onTour: () => void;
  onPage: (page: "data" | "settings" | "docs") => void;
  onLocale: (locale: Locale) => void;
  setActionsSlot: (el: HTMLElement | null) => void;
  setWindowsSlot: (el: HTMLElement | null) => void;
}) {
  const phone = useMedia(PHONE);
  const rail = collapsed && !phone;
  const root = useRef<HTMLElement>(null);
  const active = tabs.find((tab) => tab.key === activeKey) ?? null;
  // The drawer: Escape closes it, focus goes in on opening and back to the menu button on closing.
  useEffect(() => {
    if (!phone || !drawer) return;
    root.current?.querySelector<HTMLElement>(".sb-item")?.focus();
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        onDrawer(false);
        document.getElementById("sb-menu-button")?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [phone, drawer, onDrawer]);
  // Choosing anything in the drawer (a page, a tab, a command) closes it; opening a menu in it does not.
  const closeAfter = (e: React.MouseEvent) => {
    if (!phone) return;
    const target = e.target instanceof Element ? e.target.closest("button, a") : null;
    if (!target || target.matches("[aria-haspopup], .sb-collapse") || target.closest(".sb-pop-foot")) return;
    if (target.matches('[role="menuitemcheckbox"]')) return;
    onDrawer(false);
  };
  // ↑ and ↓ move between the sidebar's rows, as in a menu bar.
  const rove = (e: KeyboardEvent<HTMLElement>) => {
    if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || !(e.target instanceof HTMLElement)) return;
    if (!e.target.matches(".sb-item, .sb-tab-close") || e.target.closest(".sb-pop")) return;
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>(".sb-item:not(:disabled)")];
    const at = rows.indexOf(e.target.closest(".sb-tab")?.querySelector<HTMLElement>(".sb-item") ?? e.target);
    if (at < 0) return;
    e.preventDefault();
    rows[(at + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length]?.focus();
  };
  return (
    <>
      {phone && drawer ? <div className="sb-scrim" aria-hidden="true" onClick={() => onDrawer(false)} /> : null}
      <nav
        ref={root}
        id="app-sidebar"
        className="sidebar"
        aria-label={t(locale, "shellNav")}
        data-rail={rail || undefined}
        data-phone={phone || undefined}
        data-open={phone ? drawer || undefined : undefined}
        inert={phone && !drawer ? true : undefined}
        onClick={closeAfter}
        onKeyDown={rove}
      >
        <div className="sb-top">
          <button
            type="button"
            className="sb-mark"
            onClick={onHome}
            title={t(locale, "shellHome")}
            aria-label={`${t(locale, "appName")} · ${t(locale, "shellHome")}`}
          >
            <span className="sb-mark-name">
              <span className="sb-mark-full">{t(locale, "appName")}</span>
              <span className="sb-mark-short" aria-hidden="true">
                a
              </span>
            </span>
          </button>
          {phone ? (
            <button
              type="button"
              className="sb-collapse"
              aria-label={t(locale, "shellMenuClose")}
              title={t(locale, "shellMenuClose")}
              onClick={() => {
                onDrawer(false);
                document.getElementById("sb-menu-button")?.focus();
              }}
            >
              <Svg d="M6 6l12 12M18 6 6 18" />
            </button>
          ) : (
            <button
              type="button"
              className="sb-collapse"
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              aria-label={t(locale, collapsed ? "shellExpand" : "shellCollapse")}
              title={t(locale, collapsed ? "shellExpand" : "shellCollapse")}
              onClick={() => onCollapsed(!collapsed)}
            >
              <Svg d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
            </button>
          )}
        </div>

        <div className="sb-scroll">
          <button
            type="button"
            className="sb-item sb-home"
            aria-current={page === "home" ? "page" : undefined}
            onClick={onHome}
            title={t(locale, "shellHome")}
          >
            <span className="sb-icon">
              <Svg d={HOME} />
            </span>
            <span className="sb-label">{t(locale, "shellHome")}</span>
          </button>

          <section className="sb-section" aria-labelledby="sb-open-title">
            <div className="sb-section-head">
              <h2 id="sb-open-title" className="sb-heading">
                {t(locale, "shellOpen")}
              </h2>
              <button
                type="button"
                className="sb-add"
                data-new-project
                onClick={onNew}
                aria-label={t(locale, "shellNewProject")}
                title={t(locale, "shellNewProject")}
              >
                <Svg d={PLUS} />
              </button>
            </div>
            {tabs.length ? (
              <ul className="sb-tabs">
                {tabs.map((tab) => {
                  const name = tabName(locale, tab);
                  const current = page === "project" && tab.key === activeKey;
                  const frozen = tab.frozen ? t(locale, "projectFrozenBanner", { date: tab.asOf ?? "" }) : null;
                  return (
                    <li key={tab.key} className="sb-tab" data-tab={tab.key} data-current={current || undefined}>
                      <button
                        type="button"
                        className="sb-item"
                        aria-current={current ? "page" : undefined}
                        title={[name, frozen, tab.project ? null : t(locale, "shellUnsaved")].filter(Boolean).join(" · ")}
                        onClick={() => onTab(tab)}
                      >
                        <span className="sb-icon">
                          <Svg d={tab.project ? DOC : VIEW} />
                          {tab.frozen ? (
                            <span className="sb-frozen-dot" aria-hidden="true">
                              <Svg d={FROZEN} />
                            </span>
                          ) : null}
                        </span>
                        <span className="sb-label">
                          <span className="sb-tab-name">{name}</span>
                          {frozen ? (
                            <span className="sb-tab-meta" data-frozen>
                              {frozen}
                              {tab.drift ? ` · ${t(locale, "projectDrift")}` : ""}
                            </span>
                          ) : tab.project ? null : (
                            <span className="sb-tab-meta">{t(locale, "shellUnsaved")}</span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="sb-tab-close"
                        aria-label={t(locale, "shellCloseTab", { name })}
                        title={t(locale, "shellCloseTab", { name })}
                        onClick={() => {
                          onCloseTab(tab);
                          // The button goes with its row: keep focus in the list, on the project now shown, else Home.
                          requestAnimationFrame(() =>
                            (
                              root.current?.querySelector<HTMLElement>(".sb-tab[data-current] .sb-item") ??
                              root.current?.querySelector<HTMLElement>(".sb-home")
                            )?.focus(),
                          );
                        }}
                      >
                        <Svg d="M7 7l10 10M17 7 7 17" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="sb-empty">{t(locale, "shellNoOpen")}</p>
            )}
          </section>

          {/* Ready-made projects for each kind of user, filled in as if used. */}
          <section className="sb-section sb-demos" aria-labelledby="sb-demo-title">
            <h2 id="sb-demo-title" className="sb-heading" title={t(locale, "demoHint")}>
              {t(locale, "demoSection")}
            </h2>
            <ul className="sb-list">
              <li>
                <button type="button" className="sb-item sb-demo sb-tour" data-tour onClick={onTour}>
                  <span className="sb-icon">
                    <Svg d={PLAY} />
                  </span>
                  <span className="sb-label">{t(locale, "tourOvBoxTitle")}</span>
                </button>
              </li>
              {DEMOS.map((demo) => (
                <li key={demo.id} className="sb-demo-row">
                  <button type="button" className="sb-item sb-demo" data-demo={demo.id} onClick={() => onDemo(demo)}>
                    <span className="sb-icon">
                      <Svg d={DEMO} />
                    </span>
                    <span className="sb-label">{t(locale, demo.roleKey)}</span>
                  </button>
                  <button
                    type="button"
                    className="sb-replay"
                    data-replay={demo.id}
                    aria-label={`${t(locale, demo.roleKey)}: ${copy(locale, "replay")}`}
                    title={copy(locale, "replay")}
                    onClick={() => onDemo(demo, true)}
                  >
                    <Svg d={REPLAY} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* The open project's actions; the project view fills these slots. */}
          <section className="sb-section sb-actions" aria-labelledby="sb-actions-title" hidden={page !== "project" || !active}>
            <h2 id="sb-actions-title" className="sb-heading">
              {active?.project ? t(locale, "shellThisProject") : t(locale, "shellThisView")}
            </h2>
            <div ref={setActionsSlot} className="sb-slot" />
          </section>

          <section className="sb-section" aria-label={t(locale, "shellData")}>
            <button
              type="button"
              className="sb-item"
              data-page-data
              aria-current={page === "data" ? "page" : undefined}
              onClick={() => onPage("data")}
              title={t(locale, "shellData")}
            >
              <span className="sb-icon">
                <Svg d={DATA} />
              </span>
              <span className="sb-label">{t(locale, "shellData")}</span>
            </button>
            <button
              type="button"
              className="sb-item"
              data-page-docs
              aria-current={page === "docs" ? "page" : undefined}
              onClick={() => onPage("docs")}
              title={t(locale, "shellDocs")}
            >
              <span className="sb-icon">
                <Svg d={BOOK} />
              </span>
              <span className="sb-label">{t(locale, "shellDocs")}</span>
            </button>
          </section>
        </div>

        <div className="sb-foot">
          {rail ? null : <SitePicker locale={locale} compact />}
          <button type="button" className="sb-item" data-search onClick={openSearch} title={`${t(locale, "shellSearch")} (/ · Ctrl+K)`}>
            <span className="sb-icon">
              <Svg d={SEARCH} />
            </span>
            <span className="sb-label">
              {t(locale, "shellSearch")}
              <kbd className="sb-kbd">/</kbd>
            </span>
          </button>
          <button
            type="button"
            className="sb-item"
            data-settings
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => onPage("settings")}
            title={t(locale, "settings")}
          >
            <span className="sb-icon">
              <Gear />
            </span>
            <span className="sb-label">{t(locale, "settings")}</span>
          </button>
          {rail ? (
            <button
              type="button"
              className="sb-item"
              data-language
              lang={locale === "fi" ? "en" : "fi"}
              onClick={() => onLocale(locale === "fi" ? "en" : "fi")}
              title={`${t(locale, "language")}: ${locale === "fi" ? "English" : "Suomi"}`}
            >
              <span className="sb-icon sb-lang-code">{locale.toUpperCase()}</span>
              <span className="sb-label">{t(locale, "language")}</span>
            </button>
          ) : (
            <div className="sb-item sb-lang" role="group" aria-label={t(locale, "language")} data-language>
              <span className="sb-icon">
                <Svg d={GLOBE} />
              </span>
              <span className="sb-label" aria-hidden="true">
                {t(locale, "language")}
              </span>
              <span className="sb-lang-seg">
                {LANGS.map(([value, code, name]) => (
                  <button
                    key={value}
                    type="button"
                    lang={value}
                    aria-pressed={locale === value}
                    title={name}
                    onClick={() => onLocale(value)}
                  >
                    <span aria-hidden="true">{code}</span>
                    <span className="visually-hidden">{name}</span>
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
