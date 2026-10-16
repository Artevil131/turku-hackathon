import { useMemo } from "react";
import type { FeedMeta } from "../../feed/types.ts";
import { formatNumber, formatShare, named, t, type Locale } from "../../i18n/index.ts";
import { Card, Icon, Org, Picker, Segmented, ToggleChip, type PickerGroup } from "../../ui/index.ts";
import { capFirst, type InfectionSeverity, type TreatChoice, unitGroups } from "./model.ts";
import { institutionLabel, MONTHS, sexChipLabel } from "./text.tsx";

// "Your patient": every control one tap, sensible defaults so the answer
// shows with no input. Unit, site and severity are always set; sex is
// optional and clears with a second tap. The likely bacteria are shown, not
// chosen: the list covers all of them until the lab names one.

/** More infection sites than this: a Picker instead of a segmented control. */
const SEGMENT_MAX = 4;
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
  const unitPicker = useMemo<PickerGroup<string>[]>(() => {
    const groups = unitGroups(meta.units);
    return groups.map((g) => ({
      label: groups.length > 1 ? institutionLabel(locale, g.institution) : undefined,
      options: g.units.map((u) => ({ value: u.code, label: named(locale, u), text: `${u.fi} ${u.en} ${u.code}` })),
    }));
  }, [meta.units, locale]);

  const specimenOptions = meta.specimens.map((s) => ({ value: s.code, label: capFirst(named(locale, s)) }));
  const severityOptions: { value: InfectionSeverity; label: string }[] = [
    { value: "mild", label: t(locale, "treat.severity.mild") },
    { value: "severe", label: t(locale, "treat.severity.severe") },
  ];
  const shown = organisms.slice(0, ORGANISMS_SHOWN);

  return (
    <Card className="treat-patient" title={t(locale, "treat.patient.title")}>
      <div className="treat-patient-body">
        <Picker
          locale={locale}
          label={t(locale, "treat.patient.unit")}
          value={prefs.ward}
          groups={unitPicker}
          onChange={(ward) => ward && onPrefs({ ward })}
          icon={<Icon name="users" size={20} />}
        />

        {meta.specimens.length <= SEGMENT_MAX ? (
          <Segmented
            label={t(locale, "treat.patient.site")}
            showLabel
            value={prefs.specimen}
            options={specimenOptions}
            onChange={(specimen) => onPrefs({ specimen })}
          />
        ) : (
          <Picker
            locale={locale}
            label={t(locale, "treat.patient.site")}
            value={prefs.specimen}
            groups={[{ options: specimenOptions }]}
            onChange={(specimen) => specimen && onPrefs({ specimen })}
          />
        )}

        <Segmented<InfectionSeverity>
          label={t(locale, "treat.patient.severity")}
          showLabel
          value={prefs.severity}
          options={severityOptions}
          onChange={(severity) => onPrefs({ severity })}
        />

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
