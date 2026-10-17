import type { FeedMeta } from "../../feed/types.ts";
import { formatNumber, formatShare, type Locale, t } from "../../i18n/index.ts";
import { Card, Org, ToggleChip } from "../../ui/index.ts";
import { ContextControls } from "./ContextControls.tsx";
import type { TreatChoice } from "./model.ts";
import { MONTHS, sexChipLabel } from "./text.tsx";

// "Your patient": every control one tap, sensible defaults so the answer
// shows with no input. Unit, site and severity are always set; sex is
// optional and clears with a second tap. The likely bacteria are shown, not
// chosen: the list covers all of them until the lab names one.

/** Likely bacteria listed. */
const ORGANISMS_SHOWN = 5;

export function PatientCard({
  locale,
  meta,
  prefs,
  onPrefs,
  sexes,
  organisms,
  pool,
  min,
}: {
  locale: Locale;
  meta: FeedMeta;
  prefs: TreatChoice;
  onPrefs: (patch: Partial<TreatChoice>) => void;
  sexes: readonly string[];
  /** The server's pool, most common first (libs/utils/coverage CoverageResult.organisms). */
  organisms: readonly { organism: string; isolates: number; share: number }[];
  pool: number;
  min: number;
}) {
  const shown = organisms.slice(0, ORGANISMS_SHOWN);

  return (
    <Card className="treat-patient" title={t(locale, "treat.patient.title")}>
      <div className="treat-patient-body">
        <ContextControls locale={locale} meta={meta} prefs={prefs} onPrefs={onPrefs} />

        {sexes.length > 0 ? (
          <div className="treat-patient-group">
            <p className="treat-patient-hint">{t(locale, "treat.patient.hint")}</p>
            <div className="treat-chiprow" role="group" aria-label={t(locale, "treat.patient.sex")}>
              {sexes.map((code) => (
                <ToggleChip key={code} pressed={prefs.sex === code} onClick={() => onPrefs({ sex: prefs.sex === code ? null : code })}>
                  {sexChipLabel(locale, code)}
                </ToggleChip>
              ))}
            </div>
          </div>
        ) : null}

        {shown.length > 0 ? (
          <div className="treat-field">
            <p className="treat-field-label">{t(locale, "treat.patient.bacteria")}</p>
            <ul className="treat-likely">
              {shown.map((o) => (
                <li
                  key={o.organism}
                  className="treat-likely-row"
                  title={t(locale, "treat.patient.orgShare", { share: formatShare(locale, o.share), n: formatNumber(locale, pool) })}
                >
                  <Org name={o.organism} short />
                  <span className="treat-likely-share u-num">
                    {pool >= min ? formatShare(locale, o.share) : `${formatNumber(locale, o.isolates)}/${formatNumber(locale, pool)}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="treat-patient-hint">{t(locale, "treat.patient.bacteriaHint", { months: formatNumber(locale, MONTHS) })}</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
