import { isWardCode, type WardCode } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, type Role } from "./components/Home.tsx";
import { Research, type ResearchState } from "./components/Research.tsx";
import { Settings } from "./components/Settings.tsx";
import { type Page, TopBar } from "./components/TopBar.tsx";
import { Treat, type TreatState } from "./components/Treat.tsx";
import { type Finding, useLive } from "./live.ts";

// The organiser's reporting floor (CONTEXT.md): no percentage from fewer
// than 30 isolates. Passed down so it is set in one place.
const MIN_ISOLATES = 30;

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
  const value = location.hash.slice(1) as Page;
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
  // The doctor's own unit is remembered, so the doctor page opens where they work.
  const [treat, setTreat] = useState<TreatState>(() => ({
    ward: stored<WardCode>("aei.unit", "MED-A", isWardCode),
    specimen: "urine",
    organism: null,
    window: "recent",
    antibiotic: null,
  }));
  const [research, setResearch] = useState<ResearchState>({
    tab: "signals",
    ward: "all",
    phenotypes: [],
    days: 28,
    unseenOnly: false,
    selected: null,
    specimen: "urine",
    window: "recent",
    organism: null,
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
  useEffect(() => store("aei.unit", treat.ward), [treat.ward]);
  useEffect(() => store("aei.role", lastRole), [lastRole]);
  useEffect(() => {
    const next = page === "home" ? "" : `#${page}`;
    if (location.hash !== next) history.pushState(null, "", next || location.pathname);
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
  const patchTreat = useCallback((p: Partial<TreatState>) => setTreat((s) => ({ ...s, ...p })), []);
  const patchResearch = useCallback((p: Partial<ResearchState>) => setResearch((s) => ({ ...s, ...p })), []);
  const openSignals = useCallback((ward: WardCode) => {
    setResearch((s) => ({ ...s, ward, tab: "signals" }));
    setPage("research");
  }, []);
  const openInTreat = useCallback((f: Finding) => {
    setTreat((s) => ({ ...s, ward: f.record.ward, specimen: f.record.specimen, organism: f.record.organism, antibiotic: null }));
    setPage("doctor");
  }, []);

  return (
    <>
      <div className="chassis" aria-hidden="true" />
      <div className="console">
        <TopBar
          locale={locale}
          page={page}
          onPage={setPage}
          unseen={unseen}
          clock={live.clock}
          connection={live.connection}
          lastArrivals={live.lastArrivals}
          command={live.command}
        />

        {page === "home" ? <Home locale={locale} clock={live.clock} findings={live.findings} lastRole={lastRole} onRole={setPage} /> : null}
        {page === "doctor" ? (
          <Treat
            locale={locale}
            state={treat}
            onChange={patchTreat}
            findings={live.findings}
            records={live.records}
            asOf={live.clock?.asOf ?? null}
            minIsolates={MIN_ISOLATES}
            onOpenSignals={openSignals}
          />
        ) : null}
        {page === "research" ? (
          <Research
            locale={locale}
            state={research}
            onChange={patchResearch}
            findings={live.findings}
            asOf={live.clock?.asOf ?? null}
            acknowledge={live.acknowledge}
            onTreat={openInTreat}
            reducedMotion={reducedMotion}
            minIsolates={MIN_ISOLATES}
          />
        ) : null}
        {page === "settings" ? <Settings locale={locale} onLocale={setLocale} onResetRole={() => setLastRole(null)} /> : null}
      </div>
      {live.connection === "offline" ? (
        <p className="banner" role="status">
          {t(locale, "offline")}
        </p>
      ) : null}
    </>
  );
}
