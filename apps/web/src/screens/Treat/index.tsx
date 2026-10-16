import { useCallback, useMemo } from "react";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import type { AgeBand, Catalog, Onset, Signal } from "../../engine/types.ts";
import { coverage, DEFAULT_COVERAGE, EVERY_UNIT } from "../../engine/coverage.ts";
import { t, type Locale } from "../../i18n/index.ts";
import { useIsDesktop } from "../../ui/index.ts";
import { fallingHere, hasDetails, queryOf, sexesIn, signalsFor } from "./model.ts";
import { PatientBar, PatientCard } from "./PatientCard.tsx";
import { ResultView } from "./Result.tsx";
import { SignalStrip } from "./SignalStrip.tsx";
import "./Treat.css";

// The doctor's screen: "for patients like this one on this unit lately, how
// often did each antibiotic work?" Answers with zero input (unit remembered,
// first infection site), updates as inputs change or results arrive.
// Phones put the answer first: unit and site above it, the optional patient
// details in a sheet, this unit's alerts right after the best match.

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
  const desktop = useIsDesktop();

  const catalog = useMemo<Catalog>(() => ({ units: meta.units, antibiotics: meta.antibiotics }), [meta.units, meta.antibiotics]);
  const { ward, specimen, sex, age, onset, organism } = prefs;
  const asked = useMemo(
    () => queryOf(meta, { ward, specimen, sex, age, onset, organism }),
    [meta, ward, specimen, sex, age, onset, organism],
  );
  const cov = useMemo(() => coverage(results, asOf, asked, catalog, { rank }), [results, asOf, asked, catalog, rank]);
  const sexes = useMemo(() => sexesIn(results), [results]);
  const mine = useMemo(() => signalsFor(signals, ward, specimen, asOf), [signals, ward, specimen, asOf]);
  const falling = useMemo(() => fallingHere(mine, ward, specimen, organism), [mine, ward, specimen, organism]);
  const clearDetails = useCallback(() => onPrefs({ sex: null, age: null, onset: null, organism: null }), [onPrefs]);

  const patient = {
    locale,
    meta,
    prefs,
    onPrefs,
    sexes,
    organisms: cov.organisms,
    organismsWider: cov.basis.query.ward === EVERY_UNIT && ward !== EVERY_UNIT,
    min,
  };
  const strip = <SignalStrip locale={locale} meta={meta} signals={mine} ward={ward} min={min} onOpenSignal={onOpenSignal} />;
  const result = (
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
      falling={falling}
      onOpenSignal={onOpenSignal}
      afterTop={desktop ? null : strip}
    />
  );

  return (
    <div className={`treat${desktop ? "" : " is-phone"}`}>
      <h1 className="u-sr">{t(locale, "treat.title")}</h1>
      {desktop ? (
        <>
          {strip}
          <div className="treat-cols">
            <div className="treat-side">
              <PatientCard {...patient} />
            </div>
            <div className="treat-main">{result}</div>
          </div>
        </>
      ) : (
        <>
          <PatientBar {...patient} />
          {result}
        </>
      )}
    </div>
  );
}
