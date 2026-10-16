import type { AeiClient, Alert, CoverageResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import type { Locale } from "@aei/i18n";
import { t } from "@aei/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { previousUnits, useFlows } from "../../relations.ts";
import { hashPage, hashParams, writeHashParams } from "../../url.ts";
import { CoverageList, type ListStatus } from "./CoverageList.tsx";
import "./DoctorPage.css";
import { type DoctorFilters, filtersFromUrl, filtersToParams, storeUnit } from "./filters.ts";
import { RecordStrip } from "./RecordStrip.tsx";
import { unitSignals } from "./signals.ts";
import { UnitContext } from "./UnitContext.tsx";

// The doctor's list (spec-doctor.md with spec-amendments.md): a record strip of one-click filters over
// the coverage list, fed by GET /api/coverage only. The doctor types nothing.

export interface DoctorPageProps {
  client: AeiClient;
  locale: Locale;
  /** The replay clock's date; null while connecting. */
  asOf: string | null;
  /** Alerts of the last 28 days, newest first (live). */
  alerts: Alert[];
  /** Opens the researcher's board filtered to a unit. */
  onOpenSignals: (ward: WardCode) => void;
}

/** The part of the filters the coverage API understands; age group and onset are shown but not sent. */
const queryKey = (f: DoctorFilters) => [f.unit, f.site, f.sex, f.sev, f.period].join("|");

export function DoctorPage({ client, locale, asOf, alerts, onOpenSignals }: DoctorPageProps) {
  const [filters, setFilters] = useState<DoctorFilters>(() => filtersFromUrl(hashParams()));
  const [data, setData] = useState<{ key: string; response: CoverageResponse } | null>(null);
  const [status, setStatus] = useState<ListStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const flows = useFlows();

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

  const onChange = useCallback((patch: Partial<DoctorFilters>) => setFilters((f) => ({ ...f, ...patch })), []);
  // Figures from a different query are never shown under the new filters; only a clock tick keeps the old list while it refreshes.
  const current = data && data.key === key ? data.response : null;
  const feeders = useMemo(() => previousUnits(flows, filters.unit, 3).map((p) => p.ward), [flows, filters.unit]);
  const signals = useMemo(() => unitSignals(alerts, filters.unit, feeders, locale), [alerts, filters.unit, feeders, locale]);

  return (
    <div className="doctor">
      <button type="button" className="doctor-skip" onClick={() => document.getElementById("dr-list")?.focus()}>
        {t(locale, "drSkip")}
      </button>
      <div className="doctor-main">
        <RecordStrip locale={locale} filters={filters} onChange={onChange} />
        <div className="doctor-body">
          <CoverageList
            locale={locale}
            filters={filters}
            asOf={asOf}
            status={current ? status : status === "error" ? "error" : "loading"}
            data={current}
            signals={signals}
            onRetry={() => setAttempt((a) => a + 1)}
          />
          <UnitContext
            client={client}
            locale={locale}
            filters={filters}
            asOf={asOf}
            data={current}
            signals={signals}
            onOpenSignals={onOpenSignals}
          />
        </div>
      </div>
    </div>
  );
}
