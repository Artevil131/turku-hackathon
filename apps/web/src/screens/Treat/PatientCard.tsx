import { useMemo } from "react";
import type { AgeBand, LikelyOrganism, Onset } from "../../engine/types.ts";
import type { FeedMeta } from "../../feed/types.ts";
import { formatNumber, formatShare, named, t, type Locale } from "../../i18n/index.ts";
import { Card, Icon, Org, Picker, Segmented, ToggleChip, type PickerGroup } from "../../ui/index.ts";
import { capFirst, hasDetails, ORGANISM_CHIPS, onsetApplies, unitGroups, type TreatChoice } from "./model.ts";
import { institutionLabel, MONTHS, sexChipLabel } from "./text.tsx";

// "Your patient": every control one tap, sensible defaults so the answer
// shows with no input. Unit and site are always set; the rest is optional
// and clears with a second tap.

const AGES: readonly AgeBand[] = ["under65", "65plus"];
const ONSETS: readonly Onset[] = ["community", "hospital"];
/** More infection sites than this: a Picker instead of a segmented control. */
const SEGMENT_MAX = 4;

export function PatientCard({
  locale,
  meta,
  prefs,
  onPrefs,
  sexes,
  organisms,
  min,
}: {
  locale: Locale;
  meta: FeedMeta;
  prefs: TreatChoice;
  onPrefs: (patch: Partial<TreatChoice>) => void;
  sexes: readonly string[];
  organisms: readonly LikelyOrganism[];
  min: number;
}) {
  const unitPicker = useMemo<PickerGroup<string>[]>(() => {
    const groups = unitGroups(meta.units);
    return groups.map((g) => ({
      label: groups.length > 1 ? institutionLabel(locale, g.institution) : undefined,
      options: g.units.map((u) => ({ value: u.code, label: named(locale, u), text: `${u.fi} ${u.en} ${u.code}` })),
    }));
  }, [meta.units, locale]);

  const showOnset = onsetApplies(meta, prefs.ward);
  const total = organisms.reduce((sum, o) => sum + o.n, 0);

  // The most common organisms as chips; the rest behind "Other". The chosen
  // one always has a visible chip so it can be cleared.
  const top = organisms.slice(0, ORGANISM_CHIPS);
  const others = organisms.slice(ORGANISM_CHIPS);
  const chosenOutside = prefs.organism !== null && !top.some((o) => o.organism === prefs.organism);

  const orgHint = (o: LikelyOrganism) =>
    total >= min
      ? t(locale, "treat.patient.orgShare", { share: formatShare(locale, o.share), n: formatNumber(locale, total) })
      : t(locale, "treat.patient.orgCount", { count: formatNumber(locale, o.n), n: formatNumber(locale, total) });
  const orgFigure = (o: LikelyOrganism) => (total >= min ? formatShare(locale, o.share) : formatNumber(locale, o.n));

  const specimenOptions = meta.specimens.map((s) => ({ value: s.code, label: capFirst(named(locale, s)) }));

  return (
    <Card
      className="treat-patient"
      title={t(locale, "treat.patient.title")}
      actions={
        hasDetails(prefs) ? (
          <button
            type="button"
            className="k-btn is-ghost is-sm"
            aria-label={t(locale, "treat.patient.clearLabel")}
            onClick={() => onPrefs({ sex: null, age: null, onset: null, organism: null })}
          >
            <Icon name="close" size={16} />
            {t(locale, "treat.patient.clear")}
          </button>
        ) : undefined
      }
    >
      <div className="treat-patient-body">
        <Picker
          locale={locale}
          label={t(locale, "treat.patient.unit")}
          value={prefs.ward}
          groups={unitPicker}
          onChange={(ward) => {
            if (!ward) return;
            onPrefs(onsetApplies(meta, ward) ? { ward } : { ward, onset: null });
          }}
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

        <div className="treat-patient-group">
          <p className="treat-patient-hint">{t(locale, "treat.patient.hint")}</p>
          <div className="treat-chiprow" role="group" aria-label={`${t(locale, "treat.patient.sex")}, ${t(locale, "treat.patient.age")}`}>
            {sexes.map((code) => (
              <ToggleChip key={code} pressed={prefs.sex === code} onClick={() => onPrefs({ sex: prefs.sex === code ? null : code })}>
                {sexChipLabel(locale, code)}
              </ToggleChip>
            ))}
            {sexes.length > 0 ? <span className="treat-chiprow-sep" aria-hidden="true" /> : null}
            {AGES.map((band) => (
              <ToggleChip key={band} pressed={prefs.age === band} onClick={() => onPrefs({ age: prefs.age === band ? null : band })}>
                {t(locale, band === "65plus" ? "treat.age.65plus" : "treat.age.under65")}
              </ToggleChip>
            ))}
          </div>

          {showOnset ? (
            <div className="treat-field" role="group" aria-label={t(locale, "treat.patient.onset")}>
              <span className="treat-field-label" aria-hidden="true">
                {t(locale, "treat.patient.onset")}
              </span>
              <div className="treat-chiprow">
                {ONSETS.map((o) => (
                  <ToggleChip key={o} pressed={prefs.onset === o} onClick={() => onPrefs({ onset: prefs.onset === o ? null : o })}>
                    {t(locale, o === "hospital" ? "treat.onset.hospital" : "treat.onset.community")}
                  </ToggleChip>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="treat-field" role="group" aria-label={t(locale, "treat.patient.bacteria")}>
          <span className="treat-field-label" aria-hidden="true">
            {t(locale, "treat.patient.bacteria")}
          </span>
          <div className="k-chips is-scroll treat-orgs">
            <ToggleChip pressed={prefs.organism === null} onClick={() => onPrefs({ organism: null })}>
              {t(locale, "treat.patient.unknown")}
            </ToggleChip>
            {top.map((o) => (
              <ToggleChip
                key={o.organism}
                pressed={prefs.organism === o.organism}
                title={orgHint(o)}
                onClick={() => onPrefs({ organism: prefs.organism === o.organism ? null : o.organism })}
              >
                <Org name={o.organism} short />
                <span className="treat-org-share u-num">{orgFigure(o)}</span>
              </ToggleChip>
            ))}
            {chosenOutside && prefs.organism ? (
              <ToggleChip pressed onClick={() => onPrefs({ organism: null })}>
                <Org name={prefs.organism} short />
              </ToggleChip>
            ) : null}
            {others.length > 0 ? (
              <Picker
                locale={locale}
                label={t(locale, "treat.patient.other")}
                variant="chip"
                compact
                value={null}
                placeholder={t(locale, "treat.patient.other")}
                groups={[
                  {
                    options: others.map((o) => ({
                      value: o.organism,
                      label: <Org name={o.organism} />,
                      text: o.organism,
                      hint: orgFigure(o),
                    })),
                  },
                ]}
                onChange={(organism) => organism && onPrefs({ organism })}
              />
            ) : null}
          </div>
          <p className="treat-patient-hint">{t(locale, "treat.patient.bacteriaHint", { months: formatNumber(locale, MONTHS) })}</p>
        </div>
      </div>
    </Card>
  );
}
