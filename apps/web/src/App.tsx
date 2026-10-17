import type { Flow, Project } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandField } from "./components/command/CommandField.tsx";
import { doctorParamsToWindow } from "./components/doctor/filters.ts";
import { useMedia } from "./components/doctor/useMedia.ts";
import { projectHash } from "./components/research/projects/useProject.ts";
import { SiteLine } from "./components/SitePicker.tsx";
import { PHONE } from "./components/shell/Menu.tsx";
import { Sidebar, tabName } from "./components/shell/Sidebar.tsx";
import { type Audience, storedAudience } from "./components/start/audience.ts";
import { StartPage } from "./components/start/StartPage.tsx";
import type { DemoSpec } from "./demo/demos.ts";
import { openDemo } from "./demo/openDemo.ts";
import { useLive } from "./live.ts";
import { FlowsContext } from "./relations.ts";
import { type Shell, ShellContext, type Slots, SlotsContext } from "./shell/context.ts";
import { launchTemplate } from "./shell/launch.ts";
import { closeTab, type DocTab, loadTabs, PROJECT_PAGE, patchTab, saveTabs, tabKey, upsertTab } from "./shell/tabs.ts";
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
const DataPage = lazy(() => import("./components/data-page/DataPage.tsx").then((m) => ({ default: m.DataPage })));
const Settings = lazy(() => import("./components/Settings.tsx").then((m) => ({ default: m.Settings })));
const PitchIntro = lazy(() => import("./components/intro/PitchIntro.tsx").then((m) => ({ default: m.PitchIntro })));

const NO_FLOWS: readonly Flow[] = [];

// Light only for now. Dark tokens stay in styles.css under
// [data-theme="dark"]; switch this (or add a toggle) to bring them back.
const THEME: "light" | "dark" = "light";

type Page = "home" | "project" | "data" | "settings" | "intro";
const PAGES: readonly Page[] = ["home", "project", "data", "settings", "intro"];

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

/**
 * The page is in the URL hash so it can be bookmarked. Old routes still work: #research and #workspace
 * open the project view with the same params, #doctor opens Treat a patient with its filters (D-065),
 * #connect and #method open their sections of Data, as does #settings?section=data (the data checks).
 */
function pageFromHash(): Page {
  const value = hashPage();
  if (value === "doctor") {
    const previous = hashParams();
    const params = new URLSearchParams(doctorParamsToWindow(previous));
    if (previous.has(HOSPITAL_PARAM)) params.set(HOSPITAL_PARAM, previous.get(HOSPITAL_PARAM) as string);
    params.delete("project");
    params.set("quick", "patient");
    history.replaceState(null, "", `#${PROJECT_PAGE}?${params}`);
    return "project";
  }
  if (value === "workspace" || value === "research") {
    const query = location.hash.split("?")[1];
    history.replaceState(null, "", `#${PROJECT_PAGE}${query ? `?${query}` : ""}`);
    return "project";
  }
  const section =
    value === "connect"
      ? "feeds"
      : value === "method"
        ? "methods"
        : value === "settings" && hashParams().get("section") === "data"
          ? "quality"
          : null;
  if (section) {
    const params = new URLSearchParams(sharedQuery());
    if (section !== "feeds") params.set("section", section);
    history.replaceState(null, "", `#data${params.size ? `?${params}` : ""}`);
    return "data";
  }
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
  const [audience] = useState<Audience>(storedAudience);
  const [tabs, setTabs] = useState<DocTab[]>(() => {
    const open = loadTabs();
    return page === "project" ? upsertTab(open, location.hash) : open;
  });
  const [activeKey, setActiveKey] = useState<string | null>(() => (page === "project" ? tabKey(location.hash) : null));
  const [collapsed, setCollapsed] = useState(
    () => stored<"open" | "rail">("aei.sidebar", "open", (v) => v === "rail" || v === "open") === "rail",
  );
  const [drawer, setDrawer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slots>({ actions: null, windows: null });
  const setActionsSlot = useCallback((el: HTMLElement | null) => setSlots((s) => (s.actions === el ? s : { ...s, actions: el })), []);
  const setWindowsSlot = useCallback((el: HTMLElement | null) => setSlots((s) => (s.windows === el ? s : { ...s, windows: el })), []);
  const phone = useMedia(PHONE);
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
  useEffect(() => saveTabs(tabs), [tabs]);
  useEffect(() => store("aei.sidebar", collapsed ? "rail" : "open"), [collapsed]);

  // The project view writes its filters with replaceState, so its tab learns its latest hash before the app
  // leaves it.
  const pageRef = useRef(page);
  pageRef.current = page;
  const capture = useCallback(() => {
    if (pageRef.current !== "project" || hashPage() !== PROJECT_PAGE) return;
    const hash = location.hash;
    setTabs((open) => upsertTab(open, hash));
  }, []);
  const go = useCallback(
    (hash: string) => {
      capture();
      history.pushState(null, "", hash);
      dispatchEvent(new HashChangeEvent("hashchange"));
    },
    [capture],
  );
  const navigate = useCallback(
    (next: Exclude<Page, "project">) => go(next === "home" ? `#${sharedQuery()}` : `#${next}${sharedQuery()}`),
    [go],
  );
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activate = useCallback((tab: DocTab) => go(tab.hash), [go]);
  const close = useCallback((key: string) => {
    const wasActive = pageRef.current === "project" && tabKey(location.hash) === key;
    const { tabs: rest, next } = closeTab(tabsRef.current, key);
    setTabs(rest);
    if (!wasActive) return;
    // Replace, not push: Back should not reopen a closed tab.
    history.replaceState(null, "", next ? next.hash : `#${sharedQuery()}`);
    dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash();
      setPage(next);
      if (next === "project") {
        const hash = location.hash;
        setTabs((open) => upsertTab(open, hash));
        setActiveKey(tabKey(hash));
      }
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

  // Names for tabs restored from an earlier visit, and tabs of projects deleted since then are dropped.
  const named = useRef(false);
  useEffect(() => {
    if (named.current || !tabs.some((tab) => tab.project)) return;
    named.current = true;
    client
      .projects()
      .then(({ projects }) => {
        const byId = new Map(projects.map((p) => [p.id, p]));
        setTabs((open) =>
          open.flatMap((tab) => {
            if (!tab.project) return [tab];
            const p = byId.get(tab.project);
            if (!p) return tab.key === tabKey(location.hash) && pageRef.current === "project" ? [tab] : [];
            return [{ ...tab, name: p.name, frozen: p.mode === "frozen", asOf: p.asOf ?? null }];
          }),
        );
      })
      .catch(() => {});
  }, [client, tabs]);

  const shell = useMemo<Shell>(
    () => ({
      openProject: (project: Project) => {
        const open = tabsRef.current.find((tab) => tab.project === project.id);
        setTabs((all) =>
          patchTab(upsertTab(all, open?.hash ?? projectHash(project)), `p:${project.id}`, {
            name: project.name,
            frozen: project.mode === "frozen",
            asOf: project.asOf ?? null,
          }),
        );
        go(open?.hash ?? projectHash(project));
      },
      openView: (quick, params) => {
        const search = new URLSearchParams(params);
        if (quick) search.set("quick", quick);
        const hospital = hashParams().get(HOSPITAL_PARAM);
        if (hospital) search.set(HOSPITAL_PARAM, hospital);
        const qs = search.toString();
        go(`#${PROJECT_PAGE}${qs ? `?${qs}` : ""}`);
      },
      closeProject: (id) => close(`p:${id}`),
      projectGone: (id, name) => {
        setNotice(t(locale, "shellProjectGone", { name: name ?? t(locale, "shellUntitled") }));
        close(`p:${id}`);
      },
      closeActive: () => close(tabKey(location.hash)),
      goHome: () => navigate("home"),
      describe: ({ project, drift }) => {
        const key = tabKey(location.hash);
        if (!project || key !== `p:${project.id}`) return;
        setTabs((all) => patchTab(all, key, { name: project.name, frozen: project.mode === "frozen", asOf: project.asOf ?? null, drift }));
      },
    }),
    [go, close, navigate, locale],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  const active = page === "project" ? (tabs.find((tab) => tab.key === activeKey) ?? null) : null;
  const title =
    page === "project" && active
      ? tabName(locale, active)
      : page === "data"
        ? t(locale, "shellData")
        : page === "settings"
          ? t(locale, "settings")
          : t(locale, "shellHome");
  useEffect(() => {
    document.title = page === "home" ? t(locale, "appName") : `${title} · ${t(locale, "appName")}`;
  }, [page, title, locale]);

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

  const openDemoFile = (demo: DemoSpec) => {
    openDemo(client, locale, demo)
      .then(shell.openProject)
      .catch(() => setNotice(t(locale, "demoOpenError")));
  };
  return (
    <ShellContext.Provider value={shell}>
      <SlotsContext.Provider value={slots}>
        <SitesContext.Provider value={sites}>
          <FlowsContext.Provider value={flows}>
            <div className="chassis" aria-hidden="true" />
            {/* A button, not a link: the hash holds the page, so focus moves by script. */}
            <button type="button" className="skip-link" onClick={() => document.getElementById("main-content")?.focus()}>
              {t(locale, "skipToContent")}
            </button>
            <div className="app" data-rail={collapsed && !phone ? "" : undefined}>
              <Sidebar
                locale={locale}
                page={page}
                tabs={tabs}
                activeKey={activeKey}
                collapsed={collapsed}
                drawer={drawer}
                onDrawer={setDrawer}
                onCollapsed={setCollapsed}
                onHome={() => navigate("home")}
                onTab={activate}
                onCloseTab={(tab) => close(tab.key)}
                onDemo={openDemoFile}
                onNew={() => {
                  launchTemplate(client, locale, "blank")
                    .then(shell.openProject)
                    .catch(() => setNotice(t(locale, "pmError")));
                }}
                onPage={navigate}
                setActionsSlot={setActionsSlot}
                setWindowsSlot={setWindowsSlot}
              />
              <div className="app-main">
                {phone ? (
                  <header className="phonebar">
                    <button
                      type="button"
                      id="sb-menu-button"
                      className="phonebar-menu"
                      aria-expanded={drawer}
                      aria-controls="app-sidebar"
                      onClick={() => setDrawer(true)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M4 7h16M4 12h16M4 17h16" />
                      </svg>
                      <span className="visually-hidden">{t(locale, "shellMenu")}</span>
                    </button>
                    <span className="phonebar-title">{title}</span>
                  </header>
                ) : null}
                <main id="main-content" className="page" tabIndex={-1} data-page={page}>
                  {page === "project" && !phone ? (
                    <div className="viewbar">
                      <h1 className="viewbar-title" title={active?.project ? undefined : t(locale, "shellUnsaved")}>
                        {active ? tabName(locale, active) : t(locale, "shellUntitled")}
                      </h1>
                      {active?.frozen ? (
                        <span className="project-frozen" role="status">
                          {t(locale, "projectFrozenBanner", { date: active.asOf ?? "" })}
                          {active.drift ? <strong> · {t(locale, "projectDrift")}</strong> : null}
                        </span>
                      ) : active && !active.project ? (
                        <span className="viewbar-note">{t(locale, "shellUnsaved")}</span>
                      ) : null}
                    </div>
                  ) : page === "project" ? (
                    <h1 className="visually-hidden">{active ? tabName(locale, active) : t(locale, "shellUntitled")}</h1>
                  ) : null}
                  {page === "project" && phone && active?.frozen ? (
                    <p className="project-frozen viewbar-phone" role="status">
                      {t(locale, "projectFrozenBanner", { date: active.asOf ?? "" })}
                      {active.drift ? <strong> · {t(locale, "projectDrift")}</strong> : null}
                    </p>
                  ) : null}
                  <SiteLine locale={locale} />
                  <Fragment key={siteKey}>
                    {page === "home" ? (
                      <StartPage client={client} locale={locale} clock={live.clock?.asOf ?? null} audience={audience} onDemo={openDemoFile} />
                    ) : null}
                    <Suspense fallback={<div className="section" aria-busy="true" />}>
                      {page === "project" ? (
                        <ResearchBoard
                          key={activeKey ?? "view"}
                          client={client}
                          locale={locale}
                          asOf={live.clock?.asOf ?? null}
                          findings={findings}
                          acknowledge={live.acknowledge}
                          reducedMotion={reducedMotion}
                          replay={{
                            clock: live.clock,
                            connection: live.connection,
                            lastArrivals: live.lastArrivals,
                            command: live.command,
                            liveAlerts,
                          }}
                        />
                      ) : null}
                      {page === "data" ? (
                        <DataPage client={client} liveClient={live.client} locale={locale} asOf={live.clock?.asOf ?? null} />
                      ) : null}
                      {page === "settings" ? <Settings locale={locale} onLocale={setLocale} /> : null}
                    </Suspense>
                  </Fragment>
                </main>
              </div>
            </div>
            <div className="palette">
              <CommandField locale={locale} alerts={live.alertsLoaded ? alerts : undefined} asOf={live.clock?.asOf ?? null} />
            </div>
            {notice ? (
              <p className="toast" role="status">
                {notice}
                <button type="button" onClick={() => setNotice(null)} aria-label={t(locale, "projectClose")}>
                  ×
                </button>
              </p>
            ) : null}
            {live.connection === "offline" ? (
              <p className="banner" role="status">
                {live.lastGoodAsOf
                  ? t(locale, "offline", { date: formatDate(locale, live.lastGoodAsOf, "long") })
                  : t(locale, "offlineNoDate")}
              </p>
            ) : null}
          </FlowsContext.Provider>
        </SitesContext.Provider>
      </SlotsContext.Provider>
    </ShellContext.Provider>
  );
}
