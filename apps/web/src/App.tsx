import type { Flow } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as doctorFilters from "./components/doctor/filters.ts";
import { SiteLine } from "./components/SitePicker.tsx";
import { type Audience, storedAudience } from "./components/start/audience.ts";
import { StartPage } from "./components/start/StartPage.tsx";
import { Timeline } from "./components/Timeline.tsx";
import { type Page, TopBar } from "./components/TopBar.tsx";
import { useLive } from "./live.ts";
import { FlowsContext } from "./relations.ts";
import {
  alertsOf,
  allSites,
  flowsOf,
  HOSPITAL_PARAM,
  initialSite,
  isMulti,
  recordsOf,
  SitesContext,
  type SitesState,
  scopeClient,
  selectSite,
  setRegistry,
  siteParam,
  validSite,
} from "./sites.ts";
import { hashPage, hashParams, sharedQuery, writeSharedParam } from "./url.ts";

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
  const value = hashPage();
  if (value === "doctor") {
    const previous = hashParams();
    // TODO(coverage integration): use the direct import once the parallel coverage change lands.
    const convert = (doctorFilters as unknown as { doctorParamsToWindow?: (params: URLSearchParams) => Record<string, string> })
      .doctorParamsToWindow;
    const params = convert ? new URLSearchParams(convert(previous)) : previous;
    if (previous.has(HOSPITAL_PARAM)) params.set(HOSPITAL_PARAM, previous.get(HOSPITAL_PARAM) as string);
    params.delete("project");
    params.set("quick", "patient");
    history.replaceState(null, "", `#workspace?${params}`);
    return "research";
  }
  if (value === "workspace") return "research";
  if (value === "start") return "home";
  return PAGES.includes(value as Page) ? (value as Page) : "home";
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
  const [route, setRoute] = useState({ hash: location.hash });
  const [audience, setAudience] = useState<Audience>(storedAudience);
  const [workspaceUrl, setWorkspaceUrl] = useState("#workspace");
  const [projectName, setProjectName] = useState<string | null>(null);
  const live = useLive();
  const reducedMotion = usePrefersReducedMotion();

  // The selected hospital (D-051): one source of truth, in the URL as `hospital`, remembered, the home site by
  // default. Everything below reads it: the client asks for that hospital and the live data is cut to it.
  const [site, setSiteState] = useState<string | null>(null);
  const [sitesReady, setSitesReady] = useState(0);
  useEffect(() => {
    if (!live.meta) return;
    setRegistry(live.meta);
    const s = initialSite();
    selectSite(s);
    setSiteState(s);
    setSitesReady((n) => n + 1);
  }, [live.meta]);
  const setSite = useCallback((s: string | null) => {
    selectSite(s);
    setSiteState(s);
    writeSharedParam(HOSPITAL_PARAM, siteParam(s));
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sitesReady marks the registry as loaded
  const sites = useMemo<SitesState>(() => ({ sites: allSites(), site, multi: isMulti(), setSite }), [site, setSite, sitesReady]);
  const scope = site === null && !isMulti() ? null : site;
  // biome-ignore lint/correctness/useExhaustiveDependencies: sitesReady marks the registry as loaded
  const client = useMemo(() => scopeClient(live.client, scope), [live.client, scope, sitesReady]);
  const alerts = useMemo(() => (isMulti() ? alertsOf(live.alerts, scope) : live.alerts), [live.alerts, scope]);
  const findings = useMemo(
    () => (isMulti() ? live.findings.filter((f) => recordsOf([f.record], scope).length) : live.findings),
    [live.findings, scope],
  );
  const flows = useMemo(
    () => (live.relations ? (isMulti() ? flowsOf(live.relations.flows, scope) : live.relations.flows) : NO_FLOWS),
    [live.relations, scope],
  );
  // Pages mount again when the hospital changes, so everything they fetched is read for it.
  const siteKey = scope ?? "all";
  const liveAlerts = useMemo(() => ({ alerts, loaded: live.alertsLoaded, to: live.alertsTo }), [alerts, live.alertsLoaded, live.alertsTo]);

  useEffect(() => {
    document.documentElement.dataset.theme = THEME;
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    store("aei.locale", locale);
  }, [locale]);
  useEffect(() => {
    store("aei.audience", audience);
    document.documentElement.dataset.density = audience === "clinician" ? "comfortable" : audience === "researcher" ? "compact" : "default";
  }, [audience]);
  const navigate = useCallback(
    (next: Page) => {
      if (page === "research") setWorkspaceUrl(location.hash);
      history.pushState(null, "", next === "home" ? `#${sharedQuery()}` : next === "research" ? workspaceUrl : `#${next}${sharedQuery()}`);
      setPage(next);
      dispatchEvent(new HashChangeEvent("hashchange"));
    },
    [page, workspaceUrl],
  );
  useEffect(() => {
    const id = new URLSearchParams(route.hash.split("?")[1] ?? "").get("project");
    if (page !== "research") return;
    setWorkspaceUrl(location.hash);
    if (!id) {
      setProjectName(null);
      return;
    }
    let stale = false;
    client
      .project(id)
      .then(({ project }) => {
        if (!stale) setProjectName(project.name);
      })
      .catch(() => {
        if (!stale) setProjectName(null);
      });
    return () => {
      stale = true;
    };
  }, [client, page, route]);
  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      setRoute({ hash: location.hash });
      // Back and forward, or a pasted link, may name another hospital.
      if (isMulti()) {
        const s = validSite(hashParams().get(HOSPITAL_PARAM));
        selectSite(s);
        setSiteState(s);
      }
    };
    addEventListener("popstate", onHash);
    addEventListener("hashchange", onHash);
    return () => {
      removeEventListener("popstate", onHash);
      removeEventListener("hashchange", onHash);
    };
  }, []);

  // The pitch intro is full screen, without the working tool's chrome.
  if (page === "intro")
    return (
      <Suspense fallback={null}>
        <PitchIntro
          client={client}
          locale={locale}
          asOf={live.clock?.asOf ?? null}
          onEnter={() => navigate("home")}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    );

  return (
    <SitesContext.Provider value={sites}>
      <FlowsContext.Provider value={flows}>
        <div className="chassis" aria-hidden="true" />
        <div className="console">
          {/* A button, not a link: the hash holds the page, so focus moves by script. */}
          <button type="button" className="skip-link" onClick={() => document.getElementById("main-content")?.focus()}>
            {t(locale, "skipToContent")}
          </button>
          <TopBar
            locale={locale}
            page={page}
            onPage={navigate}
            projectName={projectName}
            asOf={live.clock?.asOf ?? null}
            alerts={live.alertsLoaded ? alerts : undefined}
          />
          {page === "research" ? (
            <Timeline
              key={siteKey}
              client={client}
              liveAlerts={liveAlerts}
              locale={locale}
              clock={live.clock}
              connection={live.connection}
              lastArrivals={live.lastArrivals}
              command={live.command}
              reducedMotion={reducedMotion}
              collapsible
            />
          ) : page === "home" && live.clock ? (
            <p className="start-clock">{t(locale, "startClock", { date: formatDate(locale, live.clock.asOf, "long") })}</p>
          ) : null}

          <main id="main-content" className="page" tabIndex={-1}>
            <SiteLine locale={locale} />
            <Fragment key={siteKey}>
              {page === "home" ? (
                <StartPage
                  client={client}
                  locale={locale}
                  clock={live.clock?.asOf ?? null}
                  alerts={alerts}
                  audience={audience}
                  onAudience={(next) => {
                    store("aei.research.layout.v2", null);
                    setAudience(next);
                  }}
                />
              ) : null}
              <Suspense fallback={<div className="section" aria-busy="true" />}>
                {page === "research" ? (
                  <ResearchBoard
                    client={client}
                    locale={locale}
                    asOf={live.clock?.asOf ?? null}
                    findings={findings}
                    acknowledge={live.acknowledge}
                    reducedMotion={reducedMotion}
                  />
                ) : null}
                {page === "method" ? <MethodPage client={client} locale={locale} asOf={live.clock?.asOf ?? null} /> : null}
                {page === "connect" ? <ConnectPage client={live.client} locale={locale} /> : null}
                {page === "settings" ? (
                  <Settings client={client} locale={locale} onLocale={setLocale} onResetRole={() => setAudience("control")} />
                ) : null}
              </Suspense>
            </Fragment>
          </main>
        </div>
        {live.connection === "offline" ? (
          <p className="banner" role="status">
            {live.lastGoodAsOf ? t(locale, "offline", { date: formatDate(locale, live.lastGoodAsOf, "long") }) : t(locale, "offlineNoDate")}
          </p>
        ) : null}
      </FlowsContext.Provider>
    </SitesContext.Provider>
  );
}
