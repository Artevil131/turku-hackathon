import { useMemo } from "react";
import type { FeedMeta } from "../../feed/types.ts";
import { formatNumber, type Locale, named, t } from "../../i18n/index.ts";
import type { AgeBand, LikelyOrganism } from "../../model/types.ts";
import { ageLabel, Org, Picker, type PickerGroup, Segmented, sexLabel, ToggleChip } from "../../ui/index.ts";
import type { ReportPrefs } from "./index.tsx";
import { cap } from "./parts.tsx";

/*
  The report's filters, compact and wrapping on phones: infection site,
  unit, bacteria, sex and age group. Every option comes from the feed's code
  lists (and the sexes present in the results); nothing is hard-coded.
*/

const AGES: readonly AgeBand[] = ["under65", "65plus"];
/** More specimens than this: a picker instead of a segmented control. */
const SEGMENT_MAX = 4;

export function Filters({
  locale,
  meta,
  prefs,
  ward,
  specimen,
  organism,
  sexes,
  organisms,
  onPrefs,
}: {
  locale: Locale;
  meta: FeedMeta;
  prefs: ReportPrefs;
  /** The checked values (stale codes already dropped). */
  ward: string | null;
  specimen: string;
  organism: string | null;
  sexes: readonly string[];
  /** Organisms found in the past 12 months for this selection, most common first. */
  organisms: readonly LikelyOrganism[];
  onPrefs: (patch: Partial<ReportPrefs>) => void;
}) {
  const unitGroups = useMemo<PickerGroup<string>[]>(
    () => [{ options: meta.units.map((u) => ({ value: u.code, label: named(locale, u), text: `${u.en} ${u.fi} ${u.code}` })) }],
    [meta, locale],
  );

  const organismGroups = useMemo<PickerGroup<string>[]>(() => {
    const counts = new Map(organisms.map((o) => [o.organism, o.n]));
    const found = organisms.filter((o) => meta.organisms.includes(o.organism));
    const missing = meta.organisms.filter((o) => !counts.has(o));
    const groups: PickerGroup<string>[] = [];
    if (found.length) {
      groups.push({
        label: t(locale, "report.filter.found"),
        options: found.map((o) => ({
          value: o.organism,
          label: <Org name={o.organism} />,
          text: o.organism,
          hint: formatNumber(locale, o.n),
        })),
      });
    }
    if (missing.length) {
      groups.push({
        label: t(locale, "report.filter.notFound"),
        options: missing.map((o) => ({ value: o, label: <Org name={o} />, text: o })),
      });
    }
    return groups;
  }, [organisms, meta, locale]);

  const siteLabel = t(locale, "report.filter.site");
  const site =
    meta.specimens.length <= SEGMENT_MAX ? (
      <Segmented
        label={siteLabel}
        value={specimen}
        options={meta.specimens.map((s) => ({ value: s.code, label: cap(locale, named(locale, s)) }))}
        onChange={(v) => onPrefs({ specimen: v })}
      />
    ) : (
      <Picker
        locale={locale}
        label={siteLabel}
        value={specimen}
        groups={[{ options: meta.specimens.map((s) => ({ value: s.code, label: cap(locale, named(locale, s)) })) }]}
        onChange={(v) => {
          if (v) onPrefs({ specimen: v });
        }}
        variant="chip"
      />
    );

  const anySet = ward !== null || organism !== null || prefs.sex !== null || prefs.age !== null;

  return (
    <div className="report-filters k-glass" role="group" aria-label={t(locale, "report.filter.label")}>
      <div className="report-filters-site">{site}</div>
      <div className="report-filters-row">
        <Picker
          locale={locale}
          label={t(locale, "report.filter.unit")}
          value={ward}
          groups={unitGroups}
          nullLabel={t(locale, "common.unit.all")}
          onChange={(v) => onPrefs({ ward: v ?? "all" })}
          variant="chip"
        />
        <Picker
          locale={locale}
          label={t(locale, "report.filter.organism")}
          value={organism}
          groups={organismGroups}
          nullLabel={t(locale, "report.filter.organismAll")}
          onChange={(v) => onPrefs({ organism: v })}
          variant="chip"
        />
        <span className="report-filters-sep" aria-hidden="true" />
        {sexes.length > 0 ? (
          <div className="report-chipset" role="group" aria-label={t(locale, "report.filter.sex")}>
            {sexes.map((s) => (
              <ToggleChip key={s} pressed={prefs.sex === s} onClick={() => onPrefs({ sex: prefs.sex === s ? null : s })}>
                {sexLabel(locale, s)}
              </ToggleChip>
            ))}
          </div>
        ) : null}
        <div className="report-chipset" role="group" aria-label={t(locale, "report.filter.age")}>
          {AGES.map((a) => (
            <ToggleChip key={a} pressed={prefs.age === a} onClick={() => onPrefs({ age: prefs.age === a ? null : a })}>
              {ageLabel(locale, a)}
            </ToggleChip>
          ))}
        </div>
        {anySet ? (
          <button
            type="button"
            className="k-btn is-ghost is-sm report-clear"
            onClick={() => onPrefs({ ward: "all", organism: null, sex: null, age: null })}
          >
            {t(locale, "report.filter.clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
