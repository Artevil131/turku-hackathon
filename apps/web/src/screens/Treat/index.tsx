import { useMemo } from "react";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { MIN_ISOLATES } from "../../model/rules.ts";
import type { Signal } from "../../model/types.ts";
import { t, type Locale } from "../../i18n/index.ts";
import { sexesIn, signalsFor, type TreatChoice } from "./model.ts";
import { PatientCard } from "./PatientCard.tsx";
import { ResultView } from "./Result.tsx";
import { SignalStrip } from "./SignalStrip.tsx";
import { useCoverage } from "./useCoverage.ts";
import "./Treat.css";

// The doctor's screen: "for patients like this one on this unit, how often
// did each antibiotic cover what grew?" The answer is the server's coverage
// list (GET /api/coverage); it shows with zero input (unit remembered, first
// infection site, mild) and updates as inputs change or results arrive.

export type TreatPrefs = TreatChoice;

export function TreatScreen(p: {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  signals: readonly Signal[];
  prefs: TreatPrefs;
  onPrefs: (patch: Partial<TreatPrefs>) => void;
  onOpenSignal: (id: string) => void;
}) {
  const { locale, meta, results, asOf, signals, prefs, onPrefs, onOpenSignal } = p;
  const min = MIN_ISOLATES;
  const { data, failed, pending } = useCoverage(prefs, asOf);
  const sexes = useMemo(() => sexesIn(results), [results]);
  const mine = useMemo(() => signalsFor(signals, prefs.ward, prefs.specimen, asOf), [signals, prefs.ward, prefs.specimen, asOf]);

  return (
    <div className="treat">
      <h1 className="u-sr">{t(locale, "treat.title")}</h1>
      <SignalStrip locale={locale} meta={meta} signals={mine} ward={prefs.ward} min={min} onOpenSignal={onOpenSignal} />
      <div className="treat-cols">
        <div className="treat-side">
          <PatientCard
            locale={locale}
            meta={meta}
            prefs={prefs}
            onPrefs={onPrefs}
            sexes={sexes}
            organisms={data?.coverage.organisms ?? []}
            pool={data?.coverage.isolates ?? 0}
            min={min}
          />
        </div>
        <div className="treat-main" aria-busy={pending}>
          <ResultView locale={locale} meta={meta} prefs={prefs} data={data} failed={failed} min={min} />
        </div>
      </div>
    </div>
  );
}
