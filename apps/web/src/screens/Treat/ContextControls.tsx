import { useMemo } from "react";
import type { FeedMeta } from "../../feed/types.ts";
import { type Locale, named, t } from "../../i18n/index.ts";
import { Icon, Picker, type PickerGroup, Segmented } from "../../ui/index.ts";
import { capFirst, type InfectionSeverity, type TreatChoice, unitGroups } from "./model.ts";
import { institutionLabel } from "./text.tsx";

// Shared by the compact phone context and the full patient form.
const SEGMENT_MAX = 4;

export function ContextControls({
  locale,
  meta,
  prefs,
  onPrefs,
}: {
  locale: Locale;
  meta: FeedMeta;
  prefs: TreatChoice;
  onPrefs: (patch: Partial<TreatChoice>) => void;
}) {
  const specimenOptions = meta.specimens.map((s) => ({ value: s.code, label: capFirst(named(locale, s)) }));
  const severityOptions: { value: InfectionSeverity; label: string }[] = [
    { value: "mild", label: t(locale, "treat.severity.mild") },
    { value: "severe", label: t(locale, "treat.severity.severe") },
  ];

  return (
    <>
      <UnitPicker locale={locale} meta={meta} ward={prefs.ward} onChange={(ward) => onPrefs({ ward })} />

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
    </>
  );
}

export function UnitPicker({
  locale,
  meta,
  ward,
  onChange,
}: {
  locale: Locale;
  meta: FeedMeta;
  ward: string;
  onChange: (ward: string) => void;
}) {
  const unitPicker = useMemo<PickerGroup<string>[]>(() => {
    const groups = unitGroups(meta.units);
    return groups.map((g) => ({
      label: groups.length > 1 ? institutionLabel(locale, g.institution) : undefined,
      options: g.units.map((u) => ({ value: u.code, label: named(locale, u), text: `${u.fi} ${u.en} ${u.code}` })),
    }));
  }, [meta.units, locale]);

  return (
    <Picker
      locale={locale}
      label={t(locale, "treat.patient.unit")}
      value={ward}
      groups={unitPicker}
      onChange={(value) => value && onChange(value)}
      icon={<Icon name="users" size={20} />}
    />
  );
}
