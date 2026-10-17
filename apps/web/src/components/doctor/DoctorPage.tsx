import type { AeiClient, Alert, CoverageResponse, FailsTogetherResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import type { Locale } from "@aei/i18n";
import { t } from "@aei/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previousUnits, useFlows } from "../../relations.ts";
import { hashPage, hashParams, writeHashParams } from "../../url.ts";
import { AsOf } from "../AsOf.tsx";
import { DataQuality } from "../DataQuality.tsx";
import { CoverageList, itemsOf, type ListStatus } from "./CoverageList.tsx";
import { Details } from "./Details.tsx";
import { FailsTogether } from "./FailsTogether.tsx";
import "./DoctorPage.css";
import { type DoctorFilters, filtersFromUrl, filtersToParams, storeUnit } from "./filters.ts";
import { RecordStrip } from "./RecordStrip.tsx";
import { unitSignals } from "./signals.ts";
import { UnitContext } from "./UnitContext.tsx";
import { useMedia } from "./useMedia.ts";

// The doctor's workspace (spec-v2.md section 4): a banner of one-click filters over a forest plot of the coverage list
// and a right column of context, on one screen. Fed by GET /api/coverage only. The doctor types nothing.

export interface DoctorPageProps {
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
}

/** Every filter the coverage call sends, so a change refetches. */
const queryKey = (f: DoctorFilters) => [f.unit, f.site, f.sex, f.age, f.onset, f.sev, f.period].join("|");

export function DoctorPage({ client, locale, asOf, alerts, alertsStatus, onRetryAlerts, onOpenSignals }: DoctorPageProps) {
  const [filters, setFilters] = useState<DoctorFilters>(() => filtersFromUrl(hashParams()));
  const [data, setData] = useState<{ key: string; response: CoverageResponse } | null>(null);
  const [status, setStatus] = useState<ListStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const flows = useFlows();
  const [selected, setSelected] = useState<string | null>(null);
  const wide = useMedia("(min-width: 960px)");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    storeUnit(filters.unit);
    writeHashParams(filtersToParams(filters));
  }, [filters]);
  // A link followed inside the app (search, home, back button) changes the hash without remounting.
  useEffect(() => {
    const onHash = () => {
      if (hashPage() === "doctor") setFilters(filtersFromUrl(hashParams()));
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const key = queryKey(filters);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry button's trigger; `key` stands for the filters it covers.
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    setStatus("loading");
    client
      .coverage({
        ward: filters.unit,
        specimen: filters.site,
        severity: filters.sev,
        windowDays: filters.period,
        ...(filters.sex === "any" ? {} : { sex: filters.sex }),
        ...(filters.age === "any" ? {} : { ageGroup: filters.age }),
        ...(filters.onset ? { onset: "hospital" as const } : {}),
      })
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

  // "Fails together" (D-048) for the same filters, fetched beside the coverage list.
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

  const onChange = useCallback((patch: Partial<DoctorFilters>) => setFilters((f) => ({ ...f, ...patch })), []);
  // Figures from a different query are never shown under the new filters; only a clock tick keeps the old list while it refreshes.
  const current = data && data.key === key ? data.response : null;
  const feeders = useMemo(() => previousUnits(flows, filters.unit, 3).map((p) => p.ward), [flows, filters.unit]);
  const signals = useMemo(() => unitSignals(alerts, filters.unit, feeders, locale), [alerts, filters.unit, feeders, locale]);

  const status2 = current ? status : status === "error" ? "error" : "loading";
  const items = useMemo(() => {
    if (!current) return [];
    const { singles, pairs } = itemsOf(current, locale);
    return [...singles, ...pairs];
  }, [current, locale]);
  const detailsDate = current?.asOf ?? null;
  const item = items.find((i) => i.id === selected) ?? null;
  const closeSheet = () => {
    const id = selected;
    setSelected(null);
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)?.focus());
  };
  // The sheet takes focus when it opens; Esc closes it and focus returns to the row.
  useEffect(() => {
    if (!wide && item) sheetRef.current?.focus();
  }, [wide, item]);

  return (
    <div className="doctor">
      <button type="button" className="doctor-skip" onClick={() => document.getElementById("dr-list")?.focus()}>
        {t(locale, "drSkip")}
      </button>
      <div className="doctor-main">
        <RecordStrip locale={locale} filters={filters} onChange={onChange} />
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
            onSelect={setSelected}
            onRetry={() => setAttempt((a) => a + 1)}
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
            />
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
                    <Details client={client} locale={locale} filters={filters} data={current} item={item} signals={signals} />
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
          className="dp-sheet"
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
          <Details client={client} locale={locale} filters={filters} data={current} item={item} signals={signals} />
          {item.row ? <FailsTogether locale={locale} antibiotic={item.row.antibiotic} data={currentFails} loading={!currentFails} /> : null}
        </div>
      ) : null}
    </div>
  );
}
