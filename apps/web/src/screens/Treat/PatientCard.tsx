import type { LikelyOrganism } from "@aei/empiric";
import type { FeedMeta } from "@aei/feed";
import type { AgeBand, Onset } from "@aei/isolates";
import { useMemo, useState } from "react";
import { formatNumber, formatShare, type Locale, named, t } from "../../i18n/index.ts";
import { Card, Icon, Org, Picker, type PickerGroup, Segmented, Sheet, shortOrganism, ToggleChip } from "../../ui/index.ts";
import { capFirst, hasDetails, midSentence, ORGANISM_CHIPS, onsetApplies, type TreatChoice, unitGroups } from "./model.ts";
import { institutionLabel, MONTHS, sexChipLabel } from "./text.tsx";

// "Your patient": every control one tap, sensible defaults so the answer
// shows with no input. Unit and site are always set; the rest is optional
// and clears with a second tap.
//   PatientCard  (from 1024 px) everything in one card beside the answer
//   PatientBar   (phones) unit and site in two rows above the answer; the
//                optional details open in a sheet, so the answer is on the
//                first screen without scrolling

const AGES: readonly AgeBand[] = ["under65", "65plus"];
const ONSETS: readonly Onset[] = ["community", "hospital"];
/** More infection sites than this: a Picker instead of a segmented control. */
const SEGMENT_MAX = 4;

interface Props {
  locale: Locale;
  meta: FeedMeta;
  prefs: TreatChoice;
  onPrefs: (patch: Partial<TreatChoice>) => void;
  sexes: readonly string[];
  organisms: readonly LikelyOrganism[];
  /** The organism shares come from every unit (this unit had too few to say). */
  organismsWider: boolean;
  min: number;
}

const CLEAR: Partial<TreatChoice> = { sex: null, age: null, onset: null, organism: null };

function UnitField({
  locale,
  meta,
  prefs,
  onPrefs,
  compact = false,
}: Pick<Props, "locale" | "meta" | "prefs" | "onPrefs"> & { compact?: boolean }) {
  const groups = useMemo<PickerGroup<string>[]>(() => {
    const list = unitGroups(meta.units);
    return list.map((g) => ({
      label: list.length > 1 ? institutionLabel(locale, g.institution) : undefined,
      options: g.units.map((u) => ({ value: u.code, label: named(locale, u), text: `${u.fi} ${u.en} ${u.code}` })),
    }));
  }, [meta.units, locale]);
  return (
    <Picker
      locale={locale}
      label={t(locale, "treat.patient.unit")}
      value={prefs.ward}
      groups={groups}
      compact={compact}
      onChange={(ward) => {
        if (!ward) return;
        onPrefs(onsetApplies(meta, ward) ? { ward } : { ward, onset: null });
      }}
      icon={<Icon name="users" size={20} />}
    />
  );
}

function SiteField({
  locale,
  meta,
  prefs,
  onPrefs,
  showLabel = true,
}: Pick<Props, "locale" | "meta" | "prefs" | "onPrefs"> & { showLabel?: boolean }) {
  const options = meta.specimens.map((s) => ({ value: s.code, label: capFirst(named(locale, s)) }));
  return meta.specimens.length <= SEGMENT_MAX ? (
    <Segmented
      label={t(locale, "treat.patient.site")}
      showLabel={showLabel}
      value={prefs.specimen}
      options={options}
      onChange={(specimen) => onPrefs({ specimen })}
    />
  ) : (
    <Picker
      locale={locale}
      label={t(locale, "treat.patient.site")}
      value={prefs.specimen}
      groups={[{ options }]}
      onChange={(specimen) => specimen && onPrefs({ specimen })}
    />
  );
}

/** Sex, age, where it was caught and the bacterium: all optional. */
function PatientDetails({ locale, meta, prefs, onPrefs, sexes, organisms, organismsWider, min }: Props) {
  const showOnset = onsetApplies(meta, prefs.ward);
  const total = organisms.reduce((sum, o) => sum + o.n, 0);

  // The most common organisms as chips; the rest behind "Other". The chosen
  // one always has a visible chip so it can be cleared.
  const top = organisms.slice(0, ORGANISM_CHIPS);
  const others = organisms.slice(ORGANISM_CHIPS);
  const chosenOutside = prefs.organism !== null && !top.some((o) => o.organism === prefs.organism);

  // A share only from `min` samples; below that the plain count.
  const orgFigure = (o: LikelyOrganism) => (total >= min ? formatShare(locale, o.share) : formatNumber(locale, o.n));
  const specimen = midSentence(
    named(
      locale,
      meta.specimens.find((s) => s.code === prefs.specimen),
      prefs.specimen,
    ),
  );
  const hint =
    total === 0
      ? t(locale, "treat.patient.bacteriaNone", { months: formatNumber(locale, MONTHS) })
      : t(locale, organismsWider ? "treat.patient.bacteriaWider" : "treat.patient.bacteriaHere", {
          n: formatNumber(locale, total),
          specimen,
          months: formatNumber(locale, MONTHS),
        });

  return (
    <div className="treat-details">
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
              ariaLabel={
                total >= min
                  ? t(locale, "treat.patient.orgShare", { organism: o.organism, share: orgFigure(o) })
                  : t(locale, "treat.patient.orgCount", { organism: o.organism, count: orgFigure(o), n: formatNumber(locale, total) })
              }
              onClick={() => onPrefs({ organism: prefs.organism === o.organism ? null : o.organism })}
            >
              <Org name={o.organism} short />
              <span className="treat-org-share u-num">{orgFigure(o)}</span>
            </ToggleChip>
          ))}
          {chosenOutside && prefs.organism ? (
            <ToggleChip pressed onClick={() => onPrefs({ organism: null })} ariaLabel={prefs.organism}>
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
                    text: `${o.organism} ${shortOrganism(o.organism)}`,
                    hint: orgFigure(o),
                  })),
                },
              ]}
              onChange={(organism) => organism && onPrefs({ organism })}
            />
          ) : null}
        </div>
        <p className="treat-patient-hint u-num">{hint}</p>
        <p className="treat-patient-hint">{t(locale, "treat.patient.bacteriaPick")}</p>
      </div>
    </div>
  );
}

export function PatientCard(p: Props) {
  const { locale, prefs, onPrefs } = p;
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
            onClick={() => onPrefs(CLEAR)}
          >
            <Icon name="close" size={16} />
            {t(locale, "treat.patient.clear")}
          </button>
        ) : undefined
      }
    >
      <div className="treat-patient-body">
        <UnitField {...p} />
        <SiteField {...p} />
        <PatientDetails {...p} />
      </div>
    </Card>
  );
}

/** How many optional details are set (for the phone's "Patient" button). */
function detailCount(p: TreatChoice): number {
  return [p.sex, p.age, p.onset, p.organism].filter((x) => x !== null).length;
}

export function PatientBar(p: Props) {
  const { locale, prefs, onPrefs } = p;
  const [open, setOpen] = useState(false);
  const count = detailCount(prefs);
  return (
    <section className="treat-bar" aria-label={t(locale, "treat.patient.title")}>
      <div className="treat-bar-row">
        <div className="treat-bar-unit">
          <UnitField {...p} compact />
        </div>
        <button
          type="button"
          className={`k-btn is-secondary treat-bar-more${count ? " has-value" : ""}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={count ? t(locale, "treat.bar.detailsSet", { count: formatNumber(locale, count) }) : t(locale, "treat.bar.details")}
        >
          <Icon name="sliders" size={18} />
          <span aria-hidden="true">{t(locale, "treat.bar.patient")}</span>
          {count ? (
            <span className="treat-bar-count u-num" aria-hidden="true">
              {formatNumber(locale, count)}
            </span>
          ) : null}
        </button>
      </div>
      <SiteField {...p} showLabel={false} />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        locale={locale}
        title={t(locale, "treat.patient.title")}
        subtitle={t(locale, "treat.bar.sheetNote")}
        footer={
          <div className="treat-sheet-actions">
            {hasDetails(prefs) ? (
              <button type="button" className="k-btn is-secondary" onClick={() => onPrefs(CLEAR)}>
                {t(locale, "treat.patient.clear")}
              </button>
            ) : null}
            <button type="button" className="k-btn is-primary" onClick={() => setOpen(false)}>
              {t(locale, "treat.bar.done")}
            </button>
          </div>
        }
      >
        <PatientDetails {...p} />
      </Sheet>
    </section>
  );
}
