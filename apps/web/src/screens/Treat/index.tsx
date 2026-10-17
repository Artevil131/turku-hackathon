import { useMemo } from "react";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { type Locale, t } from "../../i18n/index.ts";
import { MIN_ISOLATES } from "../../model/rules.ts";
import type { Signal } from "../../model/types.ts";
import { ContextControls, UnitPicker } from "./ContextControls.tsx";
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

type TreatScreenProps = {
  locale: Locale;
  meta: FeedMeta;
  results: readonly Result[];
  asOf: IsoDate;
  signals: readonly Signal[];
  prefs: TreatPrefs;
  onPrefs: (patch: Partial<TreatPrefs>) => void;
  onOpenSignal: (id: string) => void;
};

export function TreatScreen(p: TreatScreenProps) {
  if (!p.prefs.ward) {
    return (
      <div className="treat treat-first-use">
        <h1 className="treat-top-name">{t(p.locale, "treat.first.unit")}</h1>
        <UnitPicker locale={p.locale} meta={p.meta} ward="" onChange={(ward) => p.onPrefs({ ward })} />
      </div>
    );
  }
  return <TreatAnswer {...p} />;
}

function TreatAnswer(p: TreatScreenProps) {
  const { locale, meta, results, asOf, signals, prefs, onPrefs, onOpenSignal } = p;
  const min = MIN_ISOLATES;
  const { data, failed, pending } = useCoverage(prefs, asOf);
  const sexes = useMemo(() => sexesIn(results), [results]);
  const mine = useMemo(() => signalsFor(signals, prefs.ward, prefs.specimen, asOf), [signals, prefs.ward, prefs.specimen, asOf]);

  return (
    <div className="treat">
      <h1 className="u-sr">{t(locale, "treat.title")}</h1>
      <div className="treat-context" role="group" aria-label={t(locale, "treat.patient.title")}>
        <ContextControls locale={locale} meta={meta} prefs={prefs} onPrefs={onPrefs} />
      </div>
      <SignalStrip locale={locale} meta={meta} signals={mine} ward={prefs.ward} min={min} onOpenSignal={onOpenSignal} />
      <div className="treat-cols">
        <div className="treat-side" id="treat-patient">
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
          <button
            type="button"
            className="k-btn is-ghost is-sm treat-jump"
            onClick={() => document.getElementById("treat-patient")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            {t(locale, "treat.jump")}
          </button>
        </div>
      </div>
    </div>
  );
}
