import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiStatus, forgetAiStatus } from "./ai/index.ts";
import { visibleSignals } from "./engine/rules.ts";
import type { Catalog, Signal } from "./engine/types.ts";
import type { FeedCommand, FeedMeta, IsoDate } from "./feed/types.ts";
import { useFeed } from "./feed/useFeed.ts";
import { formatDate, formatNumber, LOCALES, t, type Locale } from "./i18n/index.ts";
import { unseenEpisodes } from "./screens/Alerts/filters.ts";
import { AlertsScreen } from "./screens/Alerts/index.tsx";
import { ReportScreen, type ReportPrefs } from "./screens/Report/index.tsx";
import { TimelineScreen } from "./screens/Timeline/index.tsx";
import { TreatScreen, type TreatPrefs } from "./screens/Treat/index.tsx";
import { AskSheet } from "./ui/AskSheet.tsx";
import { defaultSpecimen, defaultWard, signalKindLabel, unitName } from "./ui/defaults.ts";
import { EmptyState } from "./ui/EmptyState.tsx";
import { store, useIsDesktop, useMedia, useStored } from "./ui/hooks.ts";
import { Icon } from "./ui/Icon.tsx";
import { Settings, type AiState } from "./ui/Settings.tsx";
import { FreshChip, Header, Tabs, type Route } from "./ui/Shell.tsx";
import { SimControl } from "./ui/SimControl.tsx";
import { Toaster, type ToastItem } from "./ui/Toast.tsx";
import { useSignals } from "./ui/useSignals.ts";

// The app shell: one feed, one set of signals, hash routes, remembered
// choices, global notices. Screens get plain data and callbacks.

const ROUTES: readonly Route[] = ["treat", "alerts", "report", "timeline", "settings"];
const REMEMBERED_ROUTES: readonly Route[] = ["treat", "alerts", "report", "timeline"];
const isRoute = (v: unknown): v is Route => typeof v === "string" && (ROUTES as readonly string[]).includes(v);
const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
const isRank = (v: unknown): v is "access-first" | "coverage" => v === "access-first" || v === "coverage";
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Seen alert ids kept at most (oldest forgotten first). */
const SEEN_MAX = 600;
/** Arrival notices are skipped when the replay runs faster than this (they would flicker). */
const ARRIVAL_TOAST_MIN_TICK_MS = 1000;
const NO_SIGNALS: readonly Signal[] = [];

/** A request from another screen, e.g. "show this alert on the timeline"; `seq` makes a repeat count. */
export interface Nudge<T> {
  value: T;
  seq: number;
}

function routeFromHash(): Route | null {
  const h = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "";
  return isRoute(h) ? h : null;
}

function initialTreat(meta: FeedMeta): TreatPrefs {
  const saved = store.get<string>("ward");
  const ward = saved && meta.units.some((u) => u.code === saved) ? saved : defaultWard(meta);
  return { ward, specimen: defaultSpecimen(meta), sex: null, age: null, onset: null, organism: null };
}

function initialReport(meta: FeedMeta): ReportPrefs {
  return { ward: "all", specimen: defaultSpecimen(meta), organism: null, sex: null, age: null, view: "table" };
}

/** Patient details a caller did not mention are cleared, so another screen never keeps a narrower group than it asked for. */
const NO_DETAILS = { sex: null, age: null, onset: null, organism: null } as const;

/** Drop patch values that are not in the feed's code lists (e.g. from an older link or answer). */
function validTreatPatch(meta: FeedMeta, patch: Partial<TreatPrefs>): Partial<TreatPrefs> {
  const out: Partial<TreatPrefs> = { ...patch };
  if (out.ward !== undefined && !meta.units.some((u) => u.code === out.ward)) delete out.ward;
  if (out.specimen !== undefined && !meta.specimens.some((s) => s.code === out.specimen)) delete out.specimen;
  if (out.organism != null && !meta.organisms.includes(out.organism)) delete out.organism;
  return out;
}

export function App() {
  const feed = useFeed();
  const { meta, clock, results, asOf, status, generation, lastArrival, control: feedControl } = feed;
  const desktop = useIsDesktop();
  /** Room for the long freshness label next to the top tabs. */
  const wide = useMedia("(min-width: 1280px)");

  // ---------- Remembered choices ----------
  const [locale, setLocale] = useStored<Locale>("locale", "fi", isLocale);
  const [rank, setRank] = useStored<"access-first" | "coverage">("rank", "access-first", isRank);
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
  const onReportPrefs = useCallback((patch: Partial<ReportPrefs>) => setReportPrefs((p) => (p ? { ...p, ...patch } : p)), []);
  const openTreat = useCallback(
    (patch: Partial<TreatPrefs>) => {
      onTreatPrefs({ ...NO_DETAILS, ...patch });
      go("treat");
    },
    [onTreatPrefs, go],
  );
  const openReport = useCallback(
    (patch: Partial<ReportPrefs>) => {
      // A question about one unit is answered by that unit's table, not by the all-units view.
      const ward = patch.ward && patch.ward !== "all" ? patch.ward : null;
      onReportPrefs({ organism: null, sex: null, age: null, ward: "all", ...patch, ...(ward ? { view: "table" as const } : {}) });
      go("report");
    },
    [onReportPrefs, go],
  );
  const [alertsPreset, setAlertsPreset] = useState<Nudge<string | null> | null>(null);
  const openAlerts = useCallback(
    (unit: string | null) => {
      setAlertsPreset((n) => ({ value: unit, seq: (n?.seq ?? 0) + 1 }));
      go("alerts");
    },
    [go],
  );
  const [timelineFocus, setTimelineFocus] = useState<Nudge<{ id: string; date: IsoDate }> | null>(null);
  const openTimeline = useCallback(
    (date: IsoDate, id: string) => {
      setTimelineFocus((n) => ({ value: { id, date }, seq: (n?.seq ?? 0) + 1 }));
      go("timeline");
    },
    [go],
  );

  // ---------- Signals ----------
  const catalog = useMemo<Catalog | null>(() => (meta ? { units: meta.units, antibiotics: meta.antibiotics } : null), [meta]);
  const computed = useSignals(results, asOf, generation, catalog);
  const { signalsAsOf, signalsGen, pending } = computed;
  // Only signals computed for the results on screen, and none past the day shown:
  // right after a rewind the old list (from a later day) is never shown.
  const signals = useMemo(
    () => (asOf && signalsGen === generation ? visibleSignals(computed.signals, asOf) : NO_SIGNALS),
    [computed.signals, signalsGen, generation, asOf],
  );
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
      setSeenList((list) => {
        const known = new Set(list);
        const add = ids.filter((id) => !known.has(id));
        return add.length ? [...list, ...add].slice(-SEEN_MAX) : list;
      });
    },
    [setSeenList],
  );
  // The same count the Alerts screen calls "new" under its default view (one outbreak = one).
  const alertsBadge = useMemo(() => (asOf ? unseenEpisodes(signals, asOf, seen).length : 0), [signals, asOf, seen]);

  // ---------- Notices ----------
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pushToast = useCallback((item: ToastItem) => {
    setToasts((list) => [...list.filter((x) => x.id !== item.id), { ...item, stamp: Date.now() }].slice(-3));
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  // "Play to next alert": the replay pauses itself on the next new HIGH signal.
  const [untilAlert, setUntilAlert] = useState(false);
  const untilRef = useRef(false);
  untilRef.current = untilAlert;

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
    const stopped = untilRef.current;
    if (stopped) {
      setUntilAlert(false);
      void feedControl({ action: "pause" }).catch(() => {});
    }
    pushToast({
      id: "alert",
      tone: "alert",
      text: `${stopped ? `${t(locale, "common.sim.stopped")} · ` : ""}${t(locale, "common.toast.newAlert", { title })}${more}`,
      action: { label: t(locale, "common.toast.open"), onClick: () => openSignal(first.id) },
      timeout: stopped ? 0 : undefined,
    });
  }, [signals, signalsAsOf]);

  // A pause, a rewind or the end of the data ends "play to next alert".
  useEffect(() => {
    if (untilAlert && clock && !clock.running) setUntilAlert(false);
  }, [clock?.running]);

  // New results: a quiet counter, replaced in place.
  useEffect(() => {
    if (!lastArrival || lastArrival.count === 0) return;
    if (clock?.running && clock.tickMs < ARRIVAL_TOAST_MIN_TICK_MS) return;
    pushToast({
      id: "arrivals",
      tone: "quiet",
      text:
        lastArrival.count === 1
          ? t(locale, "common.toast.arrivalsOne", { date: formatDate(locale, lastArrival.to) })
          : t(locale, "common.toast.arrivals", { count: formatNumber(locale, lastArrival.count), date: formatDate(locale, lastArrival.to) }),
    });
  }, [lastArrival?.seq]);

  // ---------- Optional AI ----------
  const [ai, setAi] = useState<AiState>({ available: false, model: null, checking: true });
  const checkAi = useCallback(async (fresh: boolean) => {
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
  const control = useCallback(
    (command: FeedCommand) => {
      if (command.action !== "play") setUntilAlert(false);
      return feedControl(command);
    },
    [feedControl],
  );
  const playUntilAlert = useCallback(() => {
    setUntilAlert(true);
    return feedControl({ action: "play" }).catch((err: unknown) => {
      setUntilAlert(false);
      throw err;
    });
  }, [feedControl]);
  const seek = useCallback((date: string) => void feedControl({ action: "seek", date }).catch(() => {}), [feedControl]);

  const forget = useCallback(() => {
    store.clear();
    setLocale("fi");
    setRank("access-first");
    setSeenList([]);
    if (meta) setTreatPrefs(initialTreat(meta));
    if (meta) setReportPrefs(initialReport(meta));
  }, [meta, setLocale, setRank, setSeenList]);

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

  let body;
  if (route === "settings") {
    body = (
      <Settings
        locale={locale}
        onLocale={setLocale}
        rank={rank}
        onRank={setRank}
        meta={meta}
        asOf={asOf}
        resultCount={results.length}
        feedSource={`${window.location.host}/api`}
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
        rank={rank}
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
        onOpenTimeline={openTimeline}
        preset={alertsPreset}
        computing={signalsGen !== generation}
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
        onSeek={seek}
        onOpenSignal={openSignal}
        focus={timelineFocus}
      />
    );
  }

  return (
    <div className={`app${desktop ? " is-desktop" : " is-phone"}`}>
      <a className="app-skip" href="#main" onClick={(e) => {
        e.preventDefault();
        mainRef.current?.focus();
      }}>
        {t(locale, "common.skip")}
      </a>
      {/* Desktop: the simulation band stays with the header. Phones: only the header sticks, the band scrolls away. */}
      <div className="app-top">
        <Header
          locale={locale}
          route={route}
          desktop={desktop}
          fresh={fresh}
          alertsBadge={alertsBadge}
          ask={askButton}
          onLocale={setLocale}
        />
        {clock && desktop ? (
          <SimControl locale={locale} clock={clock} onControl={control} onPlayUntil={playUntilAlert} untilAlert={untilAlert} desktop />
        ) : null}
      </div>
      {clock && !desktop ? (
        <SimControl locale={locale} clock={clock} onControl={control} onPlayUntil={playUntilAlert} untilAlert={untilAlert} desktop={false} />
      ) : null}
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
          onOpenAlerts={openAlerts}
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
