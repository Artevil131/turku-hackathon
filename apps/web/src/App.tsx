import type { Flow } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { formatDate, type Locale, t } from "@aei/i18n";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { DoctorPage } from "./components/doctor/DoctorPage.tsx";
import { Home, type Role } from "./components/Home.tsx";
import { Timeline } from "./components/Timeline.tsx";
import { type Page, TopBar } from "./components/TopBar.tsx";
import { useLive } from "./live.ts";
import { FlowsContext } from "./relations.ts";
import { hashPage } from "./url.ts";

// Pages a first visit rarely opens load on demand, so home and the doctor's list paint sooner.
const ResearchBoard = lazy(() => import("./components/research/ResearchBoard.tsx").then((m) => ({ default: m.ResearchBoard })));
const ConnectPage = lazy(() => import("./components/connect/ConnectPage.tsx").then((m) => ({ default: m.ConnectPage })));
const MethodPage = lazy(() => import("./components/method/MethodPage.tsx").then((m) => ({ default: m.MethodPage })));
const Settings = lazy(() => import("./components/Settings.tsx").then((m) => ({ default: m.Settings })));
const PitchIntro = lazy(() => import("./components/intro/PitchIntro.tsx").then((m) => ({ default: m.PitchIntro })));

const NO_FLOWS: readonly Flow[] = [];

// Light only for now. Dark tokens stay in styles.css under
// [data-theme="dark"]; switch this (or add a toggle) to bring them back.
const THEME: "light" | "dark" = "light";

const PAGES: readonly Page[] = ["home", "doctor", "research", "method", "connect", "settings", "intro"];

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
  const liveAlerts = useMemo(
    () => ({ alerts: live.alerts, loaded: live.alertsLoaded, to: live.alertsTo }),
    [live.alerts, live.alertsLoaded, live.alertsTo],
  );

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

  // Opens the researcher's board filtered to a unit; the board reads its state from the URL on mount.
  const openSignals = useCallback((ward: WardCode) => {
    history.pushState(null, "", `#research?unit=${ward}`);
    setPage("research");
  }, []);

  // The pitch intro is full screen, without the working tool's chrome.
  if (page === "intro")
    return (
      <Suspense fallback={null}>
        <PitchIntro
          client={live.client}
          locale={locale}
          asOf={live.clock?.asOf ?? null}
          onEnter={() => setPage("home")}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    );

  return (
    <FlowsContext.Provider value={live.relations?.flows ?? NO_FLOWS}>
      <div className="chassis" aria-hidden="true" />
      <div className="console">
        {/* A button, not a link: the hash holds the page, so focus moves by script. */}
        <button type="button" className="skip-link" onClick={() => document.getElementById("main-content")?.focus()}>
          {t(locale, "skipToContent")}
        </button>
        <TopBar
          locale={locale}
          page={page}
          onPage={setPage}
          asOf={live.clock?.asOf ?? null}
          alerts={live.alertsLoaded ? live.alerts : undefined}
        />
        <Timeline
          client={live.client}
          liveAlerts={liveAlerts}
          locale={locale}
          clock={live.clock}
          connection={live.connection}
          lastArrivals={live.lastArrivals}
          command={live.command}
          reducedMotion={reducedMotion}
          collapsible={page !== "research"}
        />

        <main id="main-content" className="page" tabIndex={-1}>
          {page === "home" ? (
            <Home
              locale={locale}
              clock={live.clock}
              findings={live.findings}
              lastRole={lastRole}
              onRole={setPage}
              connection={live.connection}
              alerts={live.alertsLoaded ? live.alerts : undefined}
              records={live.records}
            />
          ) : null}
          {page === "doctor" ? (
            <DoctorPage
              client={live.client}
              locale={locale}
              asOf={live.clock?.asOf ?? null}
              alerts={live.alerts}
              alertsStatus={live.alertsLoaded ? "ready" : "loading"}
              onOpenSignals={openSignals}
            />
          ) : null}
          <Suspense fallback={<div className="section" aria-busy="true" />}>
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
            {page === "method" ? <MethodPage client={live.client} locale={locale} asOf={live.clock?.asOf ?? null} /> : null}
            {page === "connect" ? <ConnectPage client={live.client} locale={locale} /> : null}
            {page === "settings" ? (
              <Settings client={live.client} locale={locale} onLocale={setLocale} onResetRole={() => setLastRole(null)} />
            ) : null}
          </Suspense>
        </main>
      </div>
      {live.connection === "offline" ? (
        <p className="banner" role="status">
          {live.lastGoodAsOf ? t(locale, "offline", { date: formatDate(locale, live.lastGoodAsOf, "long") }) : t(locale, "offlineNoDate")}
        </p>
      ) : null}
    </FlowsContext.Provider>
  );
}
