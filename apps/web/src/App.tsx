import type { Flow } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DoctorPage } from "./components/doctor/DoctorPage.tsx";
import { Home, type Role } from "./components/Home.tsx";
import { ResearchBoard } from "./components/research/ResearchBoard.tsx";
import { Settings } from "./components/Settings.tsx";
import { Timeline } from "./components/Timeline.tsx";
import { type Page, TopBar } from "./components/TopBar.tsx";
import { useLive } from "./live.ts";
import { FlowsContext } from "./relations.ts";
import { hashPage } from "./url.ts";

const NO_FLOWS: readonly Flow[] = [];

// Light only for now. Dark tokens stay in styles.css under
// [data-theme="dark"]; switch this (or add a toggle) to bring them back.
const THEME: "light" | "dark" = "light";

const PAGES: readonly Page[] = ["home", "doctor", "research", "settings"];

function stored<T extends string>(key: string, fallback: T, valid: (v: string) => boolean): T {
  try {
    const value = localStorage.getItem(key);
    return value && valid(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the setting just won't persist.
  }
}

// The page is in the URL hash (#doctor, #research) so it can be bookmarked.
function pageFromHash(): Page {
  const value = hashPage() as Page;
  return PAGES.includes(value) ? value : "home";
}

function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(() => stored("aei.locale", "fi", (v) => v === "fi" || v === "en"));
  const [page, setPage] = useState<Page>(pageFromHash);
  const [lastRole, setLastRole] = useState<Role | null>(() => {
    const r = stored<Role | "">("aei.role", "", (v) => v === "doctor" || v === "research");
    return r === "" ? null : r;
  });
  const live = useLive();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.theme = THEME;
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    store("aei.locale", locale);
  }, [locale]);
  useEffect(() => store("aei.role", lastRole), [lastRole]);
  useEffect(() => {
    // Only a page change touches history; the page's own params (url.ts) stay.
    if (hashPage() !== (page === "home" ? "" : page)) history.pushState(null, "", page === "home" ? location.pathname : `#${page}`);
    if (page === "doctor" || page === "research") setLastRole(page);
  }, [page]);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    addEventListener("popstate", onHash);
    addEventListener("hashchange", onHash);
    return () => {
      removeEventListener("popstate", onHash);
      removeEventListener("hashchange", onHash);
    };
  }, []);

  const unseen = useMemo(() => live.findings.filter((f) => !f.seen).length, [live.findings]);
  // Opens the researcher's board filtered to a unit; the board reads its state from the URL on mount.
  const openSignals = useCallback((ward: WardCode) => {
    history.pushState(null, "", `#research?unit=${ward}`);
    setPage("research");
  }, []);

  return (
    <FlowsContext.Provider value={live.relations?.flows ?? NO_FLOWS}>
      <div className="chassis" aria-hidden="true" />
      <div className="console">
        <TopBar locale={locale} page={page} onPage={setPage} unseen={unseen} />
        <Timeline
          locale={locale}
          clock={live.clock}
          connection={live.connection}
          lastArrivals={live.lastArrivals}
          command={live.command}
          reducedMotion={reducedMotion}
        />

        {page === "home" ? <Home locale={locale} clock={live.clock} findings={live.findings} lastRole={lastRole} onRole={setPage} /> : null}
        {page === "doctor" ? (
          <DoctorPage
            client={live.client}
            locale={locale}
            asOf={live.clock?.asOf ?? null}
            alerts={live.alerts}
            onOpenSignals={openSignals}
          />
        ) : null}
        {page === "research" ? (
          <ResearchBoard
            client={live.client}
            locale={locale}
            asOf={live.clock?.asOf ?? null}
            findings={live.findings}
            acknowledge={live.acknowledge}
            reducedMotion={reducedMotion}
          />
        ) : null}
        {page === "settings" ? <Settings locale={locale} onLocale={setLocale} onResetRole={() => setLastRole(null)} /> : null}
      </div>
      {live.connection === "offline" ? (
        <p className="banner" role="status">
          {t(locale, "offline")}
        </p>
      ) : null}
    </FlowsContext.Provider>
  );
}
