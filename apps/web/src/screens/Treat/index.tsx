import { useCallback, useMemo } from "react";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import type { AgeBand, Catalog, Onset, Signal } from "../../engine/types.ts";
import { coverage, DEFAULT_COVERAGE } from "../../engine/coverage.ts";
import { t, type Locale } from "../../i18n/index.ts";
import { hasDetails, queryOf, sexesIn, signalsFor } from "./model.ts";
import { PatientCard } from "./PatientCard.tsx";
import { ResultView } from "./Result.tsx";
import { SignalStrip } from "./SignalStrip.tsx";
import "./Treat.css";

// The doctor's screen: "for patients like this one on this unit lately, how
// often did each antibiotic work?" Answers with zero input (unit remembered,
// first infection site), updates as inputs change or results arrive.

export interface TreatPrefs {
  ward: string;
  specimen: string;
  sex: string | null;
  age: AgeBand | null;
  onset: Onset | null;
  organism: string | null;
}

export function TreatScreen(p: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  signals: readonly Signal[];
  prefs: TreatPrefs;
  onPrefs: (patch: Partial<TreatPrefs>) => void;
  onOpenSignal: (id: string) => void;
  rank: "access-first" | "coverage";
}) {
  const { locale, meta, results, asOf, signals, prefs, onPrefs, onOpenSignal, rank } = p;
  const min = DEFAULT_COVERAGE.minIsolates;

  const catalog = useMemo<Catalog>(() => ({ units: meta.units, antibiotics: meta.antibiotics }), [meta.units, meta.antibiotics]);
  const { ward, specimen, sex, age, onset, organism } = prefs;
  const asked = useMemo(
    () => queryOf(meta, { ward, specimen, sex, age, onset, organism }),
    [meta, ward, specimen, sex, age, onset, organism],
  );
  const cov = useMemo(() => coverage(results, asOf, asked, catalog, { rank }), [results, asOf, asked, catalog, rank]);
  const sexes = useMemo(() => sexesIn(results), [results]);
  const mine = useMemo(() => signalsFor(signals, ward, specimen, asOf), [signals, ward, specimen, asOf]);
  const clearDetails = useCallback(() => onPrefs({ sex: null, age: null, onset: null, organism: null }), [onPrefs]);

  return (
    <div className="treat">
      <h1 className="u-sr">{t(locale, "treat.title")}</h1>
      <SignalStrip locale={locale} meta={meta} signals={mine} ward={ward} min={min} onOpenSignal={onOpenSignal} />
      <div className="treat-cols">
        <div className="treat-side">
          <PatientCard locale={locale} meta={meta} prefs={prefs} onPrefs={onPrefs} sexes={sexes} organisms={cov.organisms} min={min} />
        </div>
        <div className="treat-main">
          <ResultView
            locale={locale}
            meta={meta}
            results={results}
            asOf={asOf}
            catalog={catalog}
            asked={asked}
            cov={cov}
            rank={rank}
            min={min}
            onClearDetails={clearDetails}
            canClear={hasDetails(prefs)}
          />
        </div>
      </div>
    </div>
  );
}
