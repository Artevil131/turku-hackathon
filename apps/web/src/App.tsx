import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiStatus, forgetAiStatus } from "./ai/index.ts";
import type { FeedCommand, FeedMeta } from "./feed/types.ts";
import { useFeed } from "./feed/useFeed.ts";
import { formatDate, formatNumber, LOCALES, type Locale, t } from "./i18n/index.ts";
import { isActive } from "./screens/Alerts/filters.ts";
import { AlertsScreen } from "./screens/Alerts/index.tsx";
import { type ReportPrefs, ReportScreen } from "./screens/Report/index.tsx";
import { TimelineScreen } from "./screens/Timeline/index.tsx";
import { type TreatPrefs, TreatScreen } from "./screens/Treat/index.tsx";
import { AskSheet } from "./ui/AskSheet.tsx";
import { defaultSpecimen, defaultWard, signalKindLabel, unitName } from "./ui/defaults.ts";
import { EmptyState } from "./ui/EmptyState.tsx";
import { store, useIsDesktop, useMedia, useStored } from "./ui/hooks.ts";
import { Icon } from "./ui/Icon.tsx";
import { type AiState, Settings } from "./ui/Settings.tsx";
import { FreshChip, Header, type Route, Tabs } from "./ui/Shell.tsx";
import { SimControl } from "./ui/SimControl.tsx";
import { Toaster, type ToastItem } from "./ui/Toast.tsx";
import { findingCount, useQuality } from "./ui/useQuality.ts";
import { useSignals } from "./ui/useSignals.ts";

// The app shell: one feed, one set of signals, hash routes, remembered
// choices, global notices. Screens get plain data and callbacks.

const ROUTES: readonly Route[] = ["treat", "alerts", "report", "timeline", "settings"];
const REMEMBERED_ROUTES: readonly Route[] = ["treat", "alerts", "report", "timeline"];
const isRoute = (v: unknown): v is Route => typeof v === "string" && (ROUTES as readonly string[]).includes(v);
const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Seen alert ids kept at most (oldest forgotten first). */
const SEEN_MAX = 600;
/** Arrival notices are skipped when the replay runs faster than this (they would flicker). */
const ARRIVAL_TOAST_MIN_TICK_MS = 1000;

function routeFromHash(): Route | null {
  const h = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "";
  return isRoute(h) ? h : null;
}

function initialTreat(meta: FeedMeta): TreatPrefs {
  const saved = store.get<string>("ward");
  const ward = saved && meta.units.some((u) => u.code === saved) ? saved : defaultWard(meta);
  return { ward, specimen: defaultSpecimen(meta), sex: null, severity: "mild" };
}

function initialReport(meta: FeedMeta): ReportPrefs {
  return { ward: "all", specimen: defaultSpecimen(meta), organism: null, sex: null, age: null, view: "table" };
}

/** Drop patch values that are not in the feed's code lists (e.g. from an older link or answer). */
function validTreatPatch(meta: FeedMeta, patch: Partial<TreatPrefs>): Partial<TreatPrefs> {
  const out: Partial<TreatPrefs> = { ...patch };
  if (out.ward !== undefined && !meta.units.some((u) => u.code === out.ward)) delete out.ward;
  if (out.specimen !== undefined && !meta.specimens.some((s) => s.code === out.specimen)) delete out.specimen;
  if (out.severity !== undefined && out.severity !== "mild" && out.severity !== "severe") delete out.severity;
  // The server's coverage list (D-023) is for a unit, site and sex; other filters do not apply there.
  for (const key of Object.keys(out)) if (!["ward", "specimen", "sex", "severity"].includes(key)) delete out[key as keyof TreatPrefs];
  return out;
}

/** Whether a language model sits behind /llm (vite.config.ts); without one the app does not probe for it. */
const LLM_PROXY = typeof __AEI_LLM__ !== "undefined" && __AEI_LLM__;

export function App() {
  const feed = useFeed();
  const { meta, clock, results, asOf, status, generation, lastArrival, control: feedControl } = feed;
  const desktop = useIsDesktop();
  /** Room for the long freshness label next to the top tabs. */
  const wide = useMedia("(min-width: 1280px)");

  // ---------- Remembered choices ----------
  const [locale, setLocale] = useStored<Locale>("locale", "fi", isLocale);
  const [seenList, setSeenList] = useStored<string[]>("seen", [], isStringArray);
  const seen = useMemo(() => new Set(seenList), [seenList]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${t(locale, "common.app.name")} · ${t(locale, "common.app.fullName")}`;
  }, [locale]);

  // ---------- Route (the hash is the one source of truth) ----------
  const [route, setRoute] = useState<Route>(() => {
    const fromHash = routeFromHash();
    if (fromHash) return fromHash;
    const saved = store.get<string>("route");
    return isRoute(saved) && saved !== "settings" ? saved : "treat";
  });
  const mainRef = useRef<HTMLElement>(null);
  const userNavigated = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount; `route` there is the initial route written into an empty hash, and later routes come from the hash itself.
  useEffect(() => {
    if (!routeFromHash()) window.history.replaceState(null, "", `#${route}`);
    const onHash = () => {
      const next = routeFromHash() ?? "treat";
      userNavigated.current = true;
      setRoute(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if ((REMEMBERED_ROUTES as readonly string[]).includes(route)) store.set("route", route);
    if (userNavigated.current) {
      window.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [route]);

  const go = useCallback((next: Route) => {
    if (routeFromHash() === next) return;
    window.location.hash = next;
  }, []);

  // ---------- Screen preferences ----------
  const [treatPrefs, setTreatPrefs] = useState<TreatPrefs | null>(null);
  const [reportPrefs, setReportPrefs] = useState<ReportPrefs | null>(null);
  useEffect(() => {
    if (!meta) return;
    setTreatPrefs((p) => (p && meta.units.some((u) => u.code === p.ward) ? p : initialTreat(meta)));
    setReportPrefs((p) => p ?? initialReport(meta));
  }, [meta]);

  const onTreatPrefs = useCallback(
    (patch: Partial<TreatPrefs>) => {
      if (!meta) return;
      const clean = validTreatPatch(meta, patch);
      if (clean.ward !== undefined) store.set("ward", clean.ward);
      setTreatPrefs((p) => (p ? { ...p, ...clean } : p));
    },
    [meta],
  );
  const onReportPrefs = useCallback(
    (patch: Partial<ReportPrefs>) => {
      setReportPrefs((p) => (p ? { ...p, ...patch } : p));
      // A concrete unit is shared with Treat; "all" is only a Report filter.
      if (patch.ward !== undefined && patch.ward !== "all") onTreatPrefs({ ward: patch.ward });
    },
    [onTreatPrefs],
  );
  const openTreat = useCallback(
    (patch: Partial<TreatPrefs>) => {
      onTreatPrefs(patch);
      go("treat");
    },
    [onTreatPrefs, go],
  );
  const openReport = useCallback(
    (patch: Partial<ReportPrefs>) => {
      onReportPrefs(patch);
      go("report");
    },
    [onReportPrefs, go],
  );

  // ---------- Signals ----------
  const { signals, signalsAsOf, signalsGen, pending } = useSignals(results, asOf, generation);
  const [focus, setFocus] = useState<string | null>(null);
  const openSignal = useCallback(
    (id: string) => {
      setFocus(id);
      go("alerts");
    },
    [go],
  );
  const onSeen = useCallback(
    (ids: string[]) => {
      const add = ids.filter((id) => !seen.has(id));
      if (add.length) setSeenList([...seenList, ...add].slice(-SEEN_MAX));
    },
    [seen, seenList, setSeenList],
  );
  // ---------- Data checks (GET /api/quality, D-038): again after every reload and arrival ----------
  const qualityKey = `${generation}:${lastArrival?.seq ?? 0}`;
  const quality = useQuality(qualityKey);

  const alertsBadge = useMemo(
    () => (asOf ? signals.filter((s) => s.severity !== "low" && !seen.has(s.id) && isActive(s, asOf)).length : 0),
    [signals, seen, asOf],
  );

  // ---------- Notices ----------
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pushToast = useCallback((item: ToastItem) => {
    setToasts((list) => [...list.filter((x) => x.id !== item.id), { ...item, stamp: Date.now() }].slice(-3));
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  // A new HIGH signal: a toast that opens it. The first computation after a
  // (re)load only sets the baseline: what was already there is not "new".
  const knownHigh = useRef<{ gen: number; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!signalsAsOf || !meta) return;
    const high = signals.filter((s) => s.severity === "high");
    const known = knownHigh.current;
    if (!known || known.gen !== signalsGen) {
      knownHigh.current = { gen: signalsGen, ids: new Set(high.map((s) => s.id)) };
      return;
    }
    const fresh = high.filter((s) => !known.ids.has(s.id));
    for (const s of fresh) known.ids.add(s.id);
    const first = fresh[0];
    if (!first) return;
    const where = first.ward ? unitName(locale, meta, first.ward) : t(locale, "common.signal.hospital");
    const title = `${signalKindLabel(locale, first.kind)}${first.phenotype ? ` (${first.phenotype.toUpperCase()})` : ""} · ${where}`;
    const more = fresh.length > 1 ? ` ${t(locale, "common.toast.more", { count: fresh.length - 1 })}` : "";
    pushToast({
      id: "alert",
      tone: "alert",
      text: `${t(locale, "common.toast.newAlert", { title })}${more}`,
      action: { label: t(locale, "common.toast.open"), onClick: () => openSignal(first.id) },
    });
  }, [signals, signalsAsOf, signalsGen, meta, locale, pushToast, openSignal]);

  // New results: a quiet counter, replaced in place, once per arrival, with the
  // data checks run after it (it waits for that answer, or its failure).
  const toastedArrival = useRef(0);
  useEffect(() => {
    if (!lastArrival || lastArrival.count === 0 || lastArrival.seq === toastedArrival.current) return;
    if (quality.key !== qualityKey) return;
    toastedArrival.current = lastArrival.seq;
    if (clock?.running && clock.tickMs < ARRIVAL_TOAST_MIN_TICK_MS) return;
    const arrived =
      lastArrival.count === 1
        ? t(locale, "common.toast.arrivalsOne", { date: formatDate(locale, lastArrival.to) })
        : t(locale, "common.toast.arrivals", { count: formatNumber(locale, lastArrival.count), date: formatDate(locale, lastArrival.to) });
    const findings = quality.data && !quality.failed ? findingCount(quality.data) : null;
    const checks =
      findings === null
        ? ""
        : ` · ${
            findings === 0
              ? t(locale, "common.toast.checksPassed")
              : findings === 1
                ? t(locale, "common.toast.checksFoundOne")
                : t(locale, "common.toast.checksFound", { count: formatNumber(locale, findings) })
          }`;
    pushToast({ id: "arrivals", tone: "quiet", text: `${arrived}${checks}` });
  }, [lastArrival, clock, locale, pushToast, quality, qualityKey]);

  // ---------- Optional AI ----------
  const [ai, setAi] = useState<AiState>({ available: false, model: null, checking: true });
  const checkAi = useCallback(async (fresh: boolean) => {
    if (!LLM_PROXY) {
      setAi({ available: false, model: null, checking: false });
      return;
    }
    setAi((a) => ({ ...a, checking: true }));
    if (fresh) forgetAiStatus();
    const s = await aiStatus();
    setAi({ available: s.available, model: s.model ?? null, checking: false });
  }, []);
  useEffect(() => {
    void checkAi(false);
  }, [checkAi]);
  const [askOpen, setAskOpen] = useState(false);
  const sexes = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) set.add(r.sex);
    return [...set].sort();
  }, [results]);

  // ---------- Feed controls ----------
  const control = useCallback((command: FeedCommand) => feedControl(command), [feedControl]);
  const seek = useCallback((date: string) => void feedControl({ action: "seek", date }).catch(() => {}), [feedControl]);

  const forget = useCallback(() => {
    store.clear();
    setLocale("fi");
    setSeenList([]);
    if (meta) setTreatPrefs(initialTreat(meta));
    if (meta) setReportPrefs(initialReport(meta));
  }, [meta, setLocale, setSeenList]);

  // ---------- Render ----------
  const ready = meta && clock && asOf && treatPrefs && reportPrefs;

  const fresh = (
    <FreshChip locale={locale} status={status} asOf={asOf} arrivalSeq={lastArrival?.seq ?? 0} checking={pending} short={!wide} />
  );
  const askButton =
    ai.available && meta && asOf ? (
      <button type="button" className="k-btn is-ask" onClick={() => setAskOpen(true)}>
        <Icon name="sparkle" size={18} />
        <span className="app-ask-label">{t(locale, "common.ask.button")}</span>
      </button>
    ) : null;

  let body: ReactNode;
  if (route === "settings") {
    body = (
      <Settings
        locale={locale}
        onLocale={setLocale}
        meta={meta}
        asOf={asOf}
        resultCount={results.length}
        quality={quality}
        ai={ai}
        onCheckAi={() => void checkAi(true)}
        onForget={forget}
      />
    );
  } else if (!ready) {
    body =
      status === "offline" ? (
        <OfflineState locale={locale} retryAt={feed.retryAt} onRetry={feed.retry} />
      ) : (
        <EmptyState tone="loading" icon="flask" title={t(locale, "common.loading.title")} body={t(locale, "common.loading.body")} />
      );
  } else if (results.length === 0) {
    body = <EmptyState icon="inbox" title={t(locale, "common.empty.title")} body={t(locale, "common.empty.body")} />;
  } else if (route === "treat") {
    body = (
      <TreatScreen
        locale={locale}
        meta={meta}
        results={results}
        asOf={asOf}
        signals={signals}
        prefs={treatPrefs}
        onPrefs={onTreatPrefs}
        onOpenSignal={openSignal}
      />
    );
  } else if (route === "alerts") {
    body = (
      <AlertsScreen
        locale={locale}
        meta={meta}
        results={results}
        asOf={asOf}
        signals={signals}
        seen={seen}
        onSeen={onSeen}
        focus={focus}
        onFocus={setFocus}
        onOpenTreat={openTreat}
        onOpenTimeline={() => go("timeline")}
      />
    );
  } else if (route === "report") {
    body = (
      <ReportScreen
        locale={locale}
        meta={meta}
        results={results}
        asOf={asOf}
        prefs={reportPrefs}
        onPrefs={onReportPrefs}
        onOpenTreat={openTreat}
        quality={quality}
      />
    );
  } else {
    body = (
      <TimelineScreen
        locale={locale}
        meta={meta}
        results={results}
        asOf={asOf}
        clock={clock}
        signals={signals}
        quality={quality}
        onSeek={seek}
        onOpenSignal={openSignal}
      />
    );
  }

  return (
    <div className={`app${desktop ? " is-desktop" : " is-phone"}`}>
      {/* A button, not a link: the hash is the route, so "#main" would navigate. */}
      <button type="button" className="app-skip" onClick={() => mainRef.current?.focus()}>
        {t(locale, "common.skip")}
      </button>
      {/* Desktop: the simulation band stays with the header. Phones: only the header sticks, the band scrolls away. */}
      <div className="app-top">
        <Header locale={locale} route={route} desktop={desktop} fresh={fresh} alertsBadge={alertsBadge} ask={askButton} />
        {clock && desktop ? <SimControl locale={locale} clock={clock} onControl={control} desktop /> : null}
      </div>
      {clock && !desktop ? <SimControl locale={locale} clock={clock} onControl={control} desktop={false} /> : null}
      {status === "offline" && ready ? (
        <div className="app-banner" role="status">
          <Icon name="wifi-off" size={18} />
          <span>{t(locale, "common.offline.banner", { date: formatDate(locale, asOf, "long") })}</span>
          <button type="button" className="k-btn is-secondary is-sm" onClick={feed.retry}>
            {t(locale, "common.offline.retry")}
          </button>
        </div>
      ) : null}
      <main id="main" ref={mainRef} tabIndex={-1} className={`app-main is-${route}`} aria-busy={!ready && route !== "settings"}>
        {body}
      </main>
      {!desktop ? <Tabs locale={locale} route={route} alertsBadge={alertsBadge} variant="bottom" /> : null}
      <Toaster items={toasts} onDismiss={dismissToast} locale={locale} />
      {meta && asOf && ai.available ? (
        <AskSheet
          open={askOpen}
          onClose={() => setAskOpen(false)}
          locale={locale}
          meta={meta}
          asOf={asOf}
          sexes={sexes}
          onShowTreat={openTreat}
          onOpenReport={openReport}
        />
      ) : null}
    </div>
  );
}

function OfflineState({ locale, retryAt, onRetry }: { locale: Locale; retryAt: number | null; onRetry: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
  return (
    <EmptyState
      tone="offline"
      icon="wifi-off"
      title={t(locale, "common.offline.title")}
      body={t(locale, "common.offline.body", { seconds })}
      action={
        <button type="button" className="k-btn is-primary" onClick={onRetry}>
          <Icon name="refresh" size={18} />
          {t(locale, "common.offline.retry")}
        </button>
      }
    />
  );
}
