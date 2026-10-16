import { useDeferredValue, useMemo } from "react";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { formatDate, formatNumber, type Locale, t } from "../../i18n/index.ts";
import type { AgeBand, Catalog, PatientQuery } from "../../model/types.ts";
import {
  ageLabel,
  antibioticName,
  defaultSpecimen,
  Icon,
  Org,
  Segmented,
  sexLabel,
  specimenName,
  unitName,
  useMedia,
  useReducedMotion,
  useStored,
} from "../../ui/index.ts";
import { QualityLine } from "../../ui/Quality.tsx";
import type { QualityState } from "../../ui/useQuality.ts";
import type { TreatPrefs } from "../Treat/index.tsx";
import { EVERY_UNIT } from "./count.ts";
import { DrugTable } from "./DrugTable.tsx";
import { Filters } from "./Filters.tsx";
import {
  buildMatrix,
  buildTable,
  type CsvLabels,
  csvFilename,
  MIN,
  matrixCsv,
  RECENT_DAYS,
  SORT_KEYS,
  type SortKey,
  tableCsv,
  YEAR_DAYS,
} from "./model.ts";
import { CsvButton, cap, downloadCsv } from "./parts.tsx";
import { PERIODS, type Period, UnitMatrix } from "./UnitMatrix.tsx";
import "./Report.css";

/*
  The report: stewardship, ward chiefs, researchers and the lab. The brief
  taken literally: the last four weeks next to the annual figures, filtered
  by the data's own parameters (unit, infection site, bacteria, sex, age),
  updated as each day's results arrive. Two views: one row per antibiotic, or
  every unit side by side. Both download as CSV with the counting rules
  applied. Every number comes from count.ts (the team's gears).
*/

export interface ReportPrefs {
  ward: string | "all";
  specimen: string;
  organism: string | null;
  sex: string | null;
  age: AgeBand | null;
  view: "table" | "units";
}

const VIEWS: readonly ReportPrefs["view"][] = ["table", "units"];
/** Room for the antibiotics table; below it, stacked rows. */
const TABLE_QUERY = "(min-width: 880px)";

const isSortKey = (v: unknown): v is SortKey => typeof v === "string" && (SORT_KEYS as readonly string[]).includes(v);
const isPeriod = (v: unknown): v is Period => typeof v === "string" && (PERIODS as readonly string[]).includes(v);

function sexesOf(results: readonly Result[]): string[] {
  const set = new Set<string>();
  for (const r of results) if (r.sex) set.add(r.sex);
  return [...set].sort();
}

export function ReportScreen(p: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  prefs: ReportPrefs;
  onPrefs: (patch: Partial<ReportPrefs>) => void;
  onOpenTreat: (patch: Partial<TreatPrefs>) => void;
  /** The server's data checks (D-038), stated under the figures. */
  quality: QualityState;
}) {
  const { locale, meta, prefs, onPrefs, onOpenTreat } = p;
  // Arrivals during a fast replay must not block taps: the figures follow a moment later.
  const live = useMemo(() => ({ results: p.results, asOf: p.asOf }), [p.results, p.asOf]);
  const { results, asOf } = useDeferredValue(live);
  const wide = useMedia(TABLE_QUERY);
  const reducedMotion = useReducedMotion();
  const [sort, setSort] = useStored<SortKey>("reportSort", "list", isSortKey);
  const [period, setPeriod] = useStored<Period>("reportPeriod", "year", isPeriod);

  const catalog = useMemo<Catalog>(() => ({ units: meta.units, antibiotics: meta.antibiotics }), [meta]);

  // The choices as checked against the feed's lists (a stale code reads as "all").
  const ward = prefs.ward !== "all" && meta.units.some((u) => u.code === prefs.ward) ? prefs.ward : null;
  const specimen = meta.specimens.some((s) => s.code === prefs.specimen) ? prefs.specimen : defaultSpecimen(meta);
  const organism = prefs.organism && meta.organisms.includes(prefs.organism) ? prefs.organism : null;
  const { sex, age, view } = prefs;
  const sexes = useMemo(() => sexesOf(results), [results]);

  const base = useMemo<PatientQuery>(() => {
    const q: PatientQuery = { ward: EVERY_UNIT, specimen };
    if (sex) q.sex = sex;
    if (age) q.age = age;
    if (organism) q.organism = organism;
    return q;
  }, [specimen, sex, age, organism]);
  const query = useMemo<PatientQuery>(() => ({ ...base, ward: ward ?? EVERY_UNIT }), [base, ward]);
  const days = period === "recent" ? RECENT_DAYS : YEAR_DAYS;

  const table = useMemo(() => (view === "table" ? buildTable(results, asOf, query, catalog) : null), [view, results, asOf, query, catalog]);
  const matrix = useMemo(
    () => (view === "units" ? buildMatrix(results, asOf, base, catalog, days) : null),
    [view, results, asOf, base, catalog, days],
  );

  const site = cap(locale, specimenName(locale, meta, specimen));
  const unitLabel = ward ? unitName(locale, meta, ward) : t(locale, "common.unit.all");
  const patientParts = [sex ? sexLabel(locale, sex) : null, age ? ageLabel(locale, age) : null].filter((x): x is string => !!x);
  const drugName = (code: string) => antibioticName(locale, meta, code);

  const treatPatch = (w: string): Partial<TreatPrefs> => ({ ward: w, specimen, sex });

  const labels: CsvLabels = {
    unitName: (code) => unitName(locale, meta, code),
    allUnits: t(locale, "common.unit.all"),
    antibioticName: drugName,
    specimen,
    organism,
    sex,
    age,
  };

  function downloadTable() {
    if (!table) return;
    downloadCsv(csvFilename([ward ?? "all-units", specimen, organism, sex, age], asOf), tableCsv(table, labels));
  }
  function downloadMatrix() {
    if (!matrix) return;
    downloadCsv(
      csvFilename(["units", specimen, organism, sex, age, period === "recent" ? "4-weeks" : "12-months"], asOf),
      matrixCsv(matrix, labels),
    );
  }

  // Ways out of a group too small for percentages.
  const widen = [
    ward ? (
      <button key="ward" type="button" className="k-btn is-secondary is-sm" onClick={() => onPrefs({ ward: "all" })}>
        {t(locale, "common.unit.all")}
      </button>
    ) : null,
    organism ? (
      <button key="organism" type="button" className="k-btn is-secondary is-sm" onClick={() => onPrefs({ organism: null })}>
        {t(locale, "report.filter.organismAll")}
      </button>
    ) : null,
    sex || age ? (
      <button key="patients" type="button" className="k-btn is-secondary is-sm" onClick={() => onPrefs({ sex: null, age: null })}>
        {t(locale, "report.allPatients")}
      </button>
    ) : null,
  ].filter(Boolean);
  const thinActions = widen.length ? <>{widen}</> : null;

  const treatLink = ward ? (
    <button type="button" className="k-btn is-ghost is-sm report-treat" onClick={() => onOpenTreat(treatPatch(ward))}>
      <span>{t(locale, "report.treat.open", { unit: unitLabel })}</span>
      <Icon name="arrow-right" size={16} />
    </button>
  ) : null;

  return (
    <section className="report" aria-labelledby="report-title">
      <header className="report-head">
        <div className="report-head-titles">
          <h1 id="report-title" className="report-title">
            {site} · {view === "units" ? t(locale, "common.unit.all") : unitLabel}
          </h1>
          <p className="report-who">
            {organism ? <Org name={organism} /> : t(locale, "report.filter.organismAll")}
            {" · "}
            {patientParts.length ? patientParts.join(" · ") : t(locale, "report.allPatients")}
            {" · "}
            {t(locale, "report.upTo", { date: formatDate(locale, asOf, "long") })}
          </p>
        </div>
        <div className="report-view">
          <Segmented
            label={t(locale, "report.view.label")}
            value={view}
            options={VIEWS.map((v) => ({ value: v, label: t(locale, v === "table" ? "report.view.table" : "report.view.units") }))}
            onChange={(v) => onPrefs({ view: v })}
          />
        </div>
      </header>

      <Filters
        locale={locale}
        meta={meta}
        prefs={prefs}
        ward={ward}
        specimen={specimen}
        organism={organism}
        sexes={sexes}
        organisms={table?.organisms ?? matrix?.organisms ?? []}
        onPrefs={onPrefs}
      />

      {table ? (
        <DrugTable
          locale={locale}
          model={table}
          wide={wide}
          sort={sort}
          onSort={setSort}
          drugName={drugName}
          actions={<CsvButton locale={locale} onClick={downloadTable} disabled={table.rows.length === 0} />}
          treatLink={treatLink}
          thinActions={thinActions}
        />
      ) : null}

      {matrix ? (
        <UnitMatrix
          locale={locale}
          model={matrix}
          selected={ward}
          period={period}
          onPeriod={setPeriod}
          onOpenCell={(w) => onOpenTreat(treatPatch(w))}
          onOpenUnit={(w) => {
            onPrefs({ ward: w, view: "table" });
            window.requestAnimationFrame(() =>
              document.getElementById("report-title")?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" }),
            );
          }}
          unitName={(code) => unitName(locale, meta, code)}
          allUnits={t(locale, "common.unit.all")}
          drugName={drugName}
          actions={<CsvButton locale={locale} onClick={downloadMatrix} disabled={matrix.columns.length === 0} />}
        />
      ) : null}

      <footer className="report-foot">
        <p>{t(locale, "report.foot.rule", { min: formatNumber(locale, MIN) })}</p>
        {organism ? null : <p>{t(locale, "report.foot.unknown")}</p>}
        {view === "table" ? <p>{t(locale, "report.foot.aware")}</p> : null}
        <p>{t(locale, "report.foot.decide")}</p>
        <p>
          <QualityLine locale={locale} quality={p.quality} />
        </p>
      </footer>
    </section>
  );
}
