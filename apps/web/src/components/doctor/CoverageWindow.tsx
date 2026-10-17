import type { AeiClient, Alert, CoverageResponse, FailsTogetherResponse, NationalResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import type { Syndrome } from "@aei/guideline";
import type { Locale } from "@aei/i18n";
import { t } from "@aei/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previousUnits, useFlows } from "../../relations.ts";
import { hashPage, hashParams, writeHashParam, writeHashParams } from "../../url.ts";
import { AsOf } from "../AsOf.tsx";
import { DataQuality } from "../DataQuality.tsx";
import { CoverageList, itemsOf, type ListStatus } from "./CoverageList.tsx";
import { Details } from "./Details.tsx";
import { DoctorAnswer } from "./DoctorAnswer.tsx";
import { FailsTogether } from "./FailsTogether.tsx";
import "./DoctorPage.css";
import {
  barOf,
  chooseSyndrome,
  coverageQuery,
  type DoctorFilters,
  filtersFromUrl,
  filtersToParams,
  focusAb,
  focusOrg,
  patchFilters,
  storeUnit,
  syndromeOf,
} from "./filters.ts";
import { PatientPanel, type PatientState } from "./Patient.tsx";
import { RecordStrip } from "./RecordStrip.tsx";
import { SyndromePicker } from "./SyndromePicker.tsx";
import { unitSignals } from "./signals.ts";
import { UnitContext } from "./UnitContext.tsx";

// The doctor's workspace (spec-v2.md section 4): a banner of one-click filters over a forest plot of the coverage list
// and a right column of context, on one screen. Fed by GET /api/coverage only. The doctor types nothing.

export interface CoverageWindowProps {
  client: AeiClient;
  locale: Locale;
  /** The replay clock's date; null while connecting. */
  asOf: string | null;
  /** Alerts of the last 28 days, newest first (live). */
  alerts: Alert[];
  /** Optional: whether `alerts` has loaded (App does not pass it yet). Without it the signals block waits for `asOf`. */
  alertsStatus?: ListStatus;
  /** Optional: reloads the alerts backlog; the signals block shows Retry only when given. */
  onRetryAlerts?: () => void;
  /** Opens the researcher's board filtered to a unit. */
  onOpenSignals: (ward: WardCode) => void;
  /** Legacy full-page route uses unprefixed links; workspace filters use cov.*. */
  embedded?: boolean;
}

/** Read only this surface's filters, never the workspace's unit or period. */
function readCoverageFilters(embedded: boolean): DoctorFilters {
  const params = hashParams();
  return filtersFromUrl(
    embedded
      ? new URLSearchParams([...params].filter(([key]) => key.startsWith("cov.")).map(([key, value]) => [key.slice(4), value]))
      : params,
  );
}

/** The drug and organism a link asked for (`ab`, `org`; `cov.ab`, `cov.org` in a workspace). */
function readFocus(embedded: boolean): { ab: string | null; org: string | null } {
  const params = hashParams();
  const k = (name: string) => (embedded ? `cov.${name}` : name);
  return { ab: focusAb(params.get(k("ab"))), org: focusOrg(params.get(k("org"))) };
}

/** How long typing pauses before the patient id is looked up. */
const PATIENT_PAUSE_MS = 600;

/** Every filter the coverage call sends, so a change refetches. */
const queryKey = (f: DoctorFilters) => [f.unit, f.site, f.sex, f.age, f.onset, f.sev, f.period].join("|");

export function CoverageWindow({
  client,
  locale,
  asOf,
  alerts,
  alertsStatus,
  onRetryAlerts,
  onOpenSignals,
  embedded = true,
}: CoverageWindowProps) {
  const [filters, setFilters] = useState<DoctorFilters>(() => readCoverageFilters(embedded));
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWide(entry.contentRect.width >= 960);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [data, setData] = useState<{ key: string; response: CoverageResponse } | null>(null);
  const [status, setStatus] = useState<ListStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const flows = useFlows();
  const [focus, setFocus] = useState(() => readFocus(embedded));
  const [selected, setSelected] = useState<string | null>(focus.ab);
  // A link that names a drug scrolls its row into view once, when the list first has it.
  const scrolled = useRef(false);
  const [editing, setEditing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [national, setNational] = useState<NationalResponse | null>(null);
  // The patient id (D-050) lives here only: never in the URL or localStorage, cleared when the unit changes.
  const [patientId, setPatientId] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [patient, setPatient] = useState<PatientState | null>(null);
  const commitPatient = useCallback(() => setPatientQuery(patientId.trim()), [patientId]);
  useEffect(() => {
    const id = setTimeout(() => setPatientQuery(patientId.trim()), PATIENT_PAUSE_MS);
    return () => clearTimeout(id);
  }, [patientId]);
  useEffect(() => {
    if (!patientQuery || !asOf) {
      setPatient(null);
      return;
    }
    let stale = false;
    setPatient((p) => ({ status: "loading", response: p?.response?.patientId === patientQuery ? p.response : null }));
    client
      .patientFindings(patientQuery)
      .then((response) => {
        if (!stale) setPatient({ status: "ready", response });
      })
      .catch(() => {
        if (!stale) setPatient({ status: "error", response: null });
      });
    return () => {
      stale = true;
    };
  }, [client, asOf, patientQuery]);
  // The national reference (D-048) once per page; a server without the file answers 404, which means no national line.
  useEffect(() => {
    let stale = false;
    client
      .national()
      .then((n) => {
        if (!stale) setNational(n);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [client]);

  const firstWrite = useRef(true);
  const fromLink = useRef(false);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  useEffect(() => {
    storeUnit(filters.unit);
    // The first write keeps what the link asked for; a changed case or another row clears it.
    const keep = firstWrite.current || fromLink.current;
    firstWrite.current = false;
    fromLink.current = false;
    if (!keep) setFocus({ ab: null, org: null });
    const own = filtersToParams(filters);
    const k = (name: string) => (embedded ? `cov.${name}` : name);
    if (keep && focusRef.current.ab) own.ab = focusRef.current.ab;
    if (keep && focusRef.current.org) own.org = focusRef.current.org;
    if (embedded) {
      const params = Object.fromEntries(hashParams());
      for (const [key, value] of Object.entries(own)) {
        if (value) params[k(key)] = value;
        else delete params[k(key)];
      }
      if (!keep) {
        delete params["cov.ab"];
        delete params["cov.org"];
      }
      writeHashParams(params);
    } else writeHashParams(own);
  }, [filters, embedded]);
  // A link followed inside the app (search, home, back button) changes the hash without remounting.
  useEffect(() => {
    const onHash = () => {
      if (!embedded && hashPage() !== "doctor") return;
      const asked = readFocus(embedded);
      fromLink.current = true;
      scrolled.current = false;
      setFocus(asked);
      setSelected(asked.ab);
      setFilters(readCoverageFilters(embedded));
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [embedded]);

  const key = queryKey(filters);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry button's trigger; `key` stands for the filters it covers.
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    setStatus("loading");
    client
      .coverage(coverageQuery(filters))
      .then((response) => {
        if (stale) return;
        setData({ key, response });
        setStatus("ready");
      })
      .catch(() => {
        if (!stale) setStatus("error");
      });
    return () => {
      stale = true;
    };
  }, [client, asOf, key, attempt]);

  // "Fails together" (D-054) for the same filters, fetched beside the coverage list.
  const [fails, setFails] = useState<{ key: string; response: FailsTogetherResponse } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the filters it covers.
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    client
      .failsTogether({
        ward: filters.unit,
        specimen: filters.site,
        windowDays: filters.period,
        ...(filters.sex === "any" ? {} : { sex: filters.sex }),
        ...(filters.age === "any" ? {} : { ageGroup: filters.age }),
        ...(filters.onset ? { onset: "hospital" as const } : {}),
      })
      .then((response) => {
        if (!stale) setFails({ key, response });
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [client, asOf, key]);
  const currentFails = fails && fails.key === key ? fails.response : null;

  const onChange = useCallback((patch: Partial<DoctorFilters>) => {
    if (patch.unit !== undefined) {
      setPatientId("");
      setPatientQuery("");
    }
    setFilters((f) => patchFilters(f, patch));
  }, []);
  const syndrome = useMemo(() => syndromeOf(filters.syn) ?? null, [filters.syn]);
  const onSyndrome = useCallback((s: Syndrome | null) => setFilters((f) => chooseSyndrome(f, s)), []);
  // Figures from a different query are never shown under the new filters; only a clock tick keeps the old list while it refreshes.
  const current = data && data.key === key ? data.response : null;
  const feeders = useMemo(() => previousUnits(flows, filters.unit, 3).map((p) => p.ward), [flows, filters.unit]);
  const signals = useMemo(() => unitSignals(alerts, filters.unit, feeders, locale), [alerts, filters.unit, feeders, locale]);

  const patientFindings = patient?.response ?? null;
  const status2 = current ? status : status === "error" ? "error" : "loading";
  const items = useMemo(() => {
    if (!current) return [];
    const { singles, pairs } = itemsOf(current, locale, patientFindings);
    return [...singles, ...pairs];
  }, [current, locale, patientFindings]);
  const detailsDate = current?.asOf ?? null;
  const item = items.find((i) => i.id === selected) ?? null;
  useEffect(() => {
    if (scrolled.current || !focus.ab || !item) return;
    scrolled.current = true;
    requestAnimationFrame(() =>
      surfaceRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(item.id)}"]`)?.scrollIntoView({ block: "nearest" }),
    );
  }, [focus.ab, item]);
  const pickRow = (id: string | null) => {
    fromLink.current = false;
    setSelected(id);
    setFocus((f) => (f.ab ? { ...f, ab: null } : f));
    if (focus.ab) writeHashParam(embedded ? "cov.ab" : "ab", null);
  };
  const closeSheet = () => {
    const id = selected;
    setSelected(null);
    if (id) requestAnimationFrame(() => surfaceRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)?.focus());
  };
  // The sheet takes focus when it opens; Esc closes it and focus returns to the row.
  useEffect(() => {
    if (!wide && item) sheetRef.current?.focus();
  }, [wide, item]);

  return (
    <div className={embedded ? "coverage-surface coverage-window" : "coverage-surface"} ref={surfaceRef}>
      <div className="doctor">
        <button type="button" className="doctor-skip" onClick={() => surfaceRef.current?.querySelector<HTMLElement>("#dr-list")?.focus()}>
          {t(locale, "drSkip")}
        </button>
        <div className="doctor-main" hidden={embedded && !wide && !!current && !!item}>
          <div className="dr-top">
            <DoctorAnswer
              locale={locale}
              filters={filters}
              items={items}
              bar={barOf(current, filters)}
              loading={status2 === "loading" && !current}
              failed={status2 === "error" && !current}
              editing={editing}
              asOf={current?.asOf ?? null}
              windowDays={filters.period}
              onEdit={() => setEditing((v) => !v)}
              showCase={!wide}
            />
            {/* Wide: the case sits beside the answer, always open. Narrow: it waits behind "Edit case". */}
            <div className="dr-case" data-open={editing || wide || undefined}>
              <h2 className="dr-case-title">{t(locale, "drCaseTitle")}</h2>
              <SyndromePicker locale={locale} value={filters.syn} onPick={onSyndrome} />
              <RecordStrip
                locale={locale}
                wide={wide}
                filters={filters}
                onChange={onChange}
                patientId={patientId}
                onPatientId={setPatientId}
                onPatientCommit={commitPatient}
              />
            </div>
          </div>
          <div className="doctor-body">
            <CoverageList
              source={<DataQuality client={client} locale={locale} />}
              locale={locale}
              filters={filters}
              asOf={asOf}
              status={status2}
              data={current}
              signals={signals}
              selected={item ? item.id : null}
              onSelect={pickRow}
              onRetry={() => setAttempt((a) => a + 1)}
              syndrome={syndrome}
              patient={patientFindings}
            />
            <aside className="dp-side" aria-label={t(locale, "drInUnit")}>
              <UnitContext
                client={client}
                locale={locale}
                filters={filters}
                asOf={asOf}
                data={current}
                signals={signals}
                status={status2}
                onRetry={() => setAttempt((a) => a + 1)}
                alertsStatus={alertsStatus}
                onRetryAlerts={onRetryAlerts}
                onOpenSignals={onOpenSignals}
                highlightOrganism={focus.org}
              />
              <PatientPanel locale={locale} state={patient} syndrome={syndrome} />
              {wide ? (
                <section id="dr-details" className="dt-panel dp-panel" aria-labelledby="dt-title" aria-live="polite">
                  <h3 id="dt-title" className="dt-title">
                    {t(locale, "drDetails")}
                    {detailsDate ? (
                      <>
                        {" "}
                        <AsOf locale={locale} date={detailsDate} />
                      </>
                    ) : null}
                  </h3>
                  {current && item ? (
                    <>
                      <Details
                        client={client}
                        locale={locale}
                        filters={filters}
                        data={current}
                        item={item}
                        signals={signals}
                        syndrome={syndrome}
                        national={national}
                      />
                      {item.row ? (
                        <FailsTogether locale={locale} antibiotic={item.row.antibiotic} data={currentFails} loading={!currentFails} />
                      ) : null}
                    </>
                  ) : (
                    <p className="dt-empty">{t(locale, "drSelectRow")}</p>
                  )}
                </section>
              ) : null}
            </aside>
          </div>
        </div>
        {!wide && current && item ? (
          <div
            id="dr-details"
            className={embedded ? "dp-sheet dp-sheet-contained" : "dp-sheet"}
            role="dialog"
            aria-label={t(locale, "drDetails")}
            tabIndex={-1}
            ref={sheetRef}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeSheet();
            }}
          >
            <div className="dp-sheet-head">
              <h2>
                {t(locale, "drDetails")}
                {detailsDate ? (
                  <>
                    {" "}
                    <AsOf locale={locale} date={detailsDate} />
                  </>
                ) : null}
              </h2>
              <button type="button" className="dp-close" onClick={closeSheet}>
                {t(locale, "drClose")}
              </button>
            </div>
            <Details
              client={client}
              locale={locale}
              filters={filters}
              data={current}
              item={item}
              signals={signals}
              syndrome={syndrome}
              national={national}
            />
            {item.row ? (
              <FailsTogether locale={locale} antibiotic={item.row.antibiotic} data={currentFails} loading={!currentFails} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
