import type { Severity } from "@aei/contract";
import type { Sex, Specimen, WardCode } from "@aei/domain";
import { type Locale, type MessageKey, specimenName, t, wardName } from "@aei/i18n";
import { type ReactNode, useState } from "react";
import { AGE_GROUPS, AGE_KEYS, type AgeGroup, type DoctorFilters, type Period, SITES, sexWord, unitGroups } from "./filters.ts";
import { useMedia } from "./useMedia.ts";
import "./RecordStrip.css";

interface Props {
  locale: Locale;
  filters: DoctorFilters;
  onChange: (patch: Partial<DoctorFilters>) => void;
}

function Group({ label, tag, inline, children }: { label: string; tag?: string | false; inline?: boolean; children: ReactNode }) {
  return (
    <div className="rs-group" data-inline={inline ? "" : undefined} role="group" aria-label={label}>
      <span className="rs-label">
        {label}
        {tag ? <span className="rs-tag">{tag}</span> : null}
      </span>
      {children}
    </div>
  );
}

function Choices<T extends string | number>(props: {
  options: readonly (readonly [T, string, string?])[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="rs-choices">
      {props.options.map(([value, text, title]) => (
        <button
          key={value}
          type="button"
          className="rs-choice"
          title={title}
          aria-pressed={props.value === value}
          onClick={() => props.onPick(value)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** The patient record as a row of one-click filters, each with its default already chosen. The doctor types nothing. */
export function RecordStrip({ locale, filters, onChange }: Props) {
  const tr = (key: MessageKey) => t(locale, key);
  const notApplied = tr("drNotApplied");
  const wide = useMedia("(min-width: 701px)");
  const [more, setMore] = useState(false);
  // On the phone a change made behind "More filters" folds the panel again, so the list stays in view.
  const change = (patch: Partial<DoctorFilters>) => {
    onChange(patch);
    if (!wide) setMore(false);
  };
  const summary = [
    wardName(locale, filters.unit),
    specimenName(locale, filters.site),
    sexWord(locale, filters.sex),
    tr(filters.sev === "mild" ? "drSevMildShort" : "drSevSevereShort"),
    tr(filters.period === 365 ? "drPeriodYear" : "drPeriodMonth"),
    filters.age !== "any" ? tr(AGE_KEYS[filters.age]) : null,
    filters.onset ? tr("drOnset") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const unit = (
    <label className="rs-group rs-unit">
      <span className="rs-label">{tr("drUnit")}</span>
      <select className="rs-select" value={filters.unit} onChange={(e) => change({ unit: e.target.value as WardCode })}>
        <optgroup label={tr("hospital")}>
          {unitGroups.hospital.map((w) => (
            <option key={w.code} value={w.code}>
              {wardName(locale, w.code)}
            </option>
          ))}
        </optgroup>
        <optgroup label={tr("primaryCare")}>
          {unitGroups.primary.map((w) => (
            <option key={w.code} value={w.code}>
              {wardName(locale, w.code)}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
  const site = (
    <Group label={tr("drSite")}>
      <Choices<Specimen>
        options={SITES.map((s) => [s, specimenName(locale, s)] as const)}
        value={filters.site}
        onPick={(s) => change({ site: s })}
      />
    </Group>
  );
  const sex = (
    <Group label={tr("drSex")} inline>
      <Choices<Sex | "any">
        options={[
          ["any", tr("drSexAny")],
          ["F", tr("drSexF"), tr("drSexFWord")],
          ["M", tr("drSexM"), tr("drSexMWord")],
        ]}
        value={filters.sex}
        onPick={(v) => onChange({ sex: v })}
      />
    </Group>
  );
  const severity = (
    <Group label={tr("drSeverity")} inline>
      <Choices<Severity>
        options={[
          ["mild", tr("drSevMild")],
          ["severe", tr("drSevSevere")],
        ]}
        value={filters.sev}
        onPick={(v) => onChange({ sev: v })}
      />
    </Group>
  );
  const period = (
    <Group label={tr("drPeriod")}>
      <Choices<Period>
        options={[
          [365, tr("drPeriodYear")],
          [28, tr("drPeriodMonth")],
        ]}
        value={filters.period}
        onPick={(v) => change({ period: v })}
      />
    </Group>
  );
  const age = (
    <Group label={tr("drAge")} tag={filters.age !== "any" && notApplied}>
      <Choices<AgeGroup>
        options={AGE_GROUPS.map((a) => [a, tr(AGE_KEYS[a])] as const)}
        value={filters.age}
        onPick={(v) => onChange({ age: v })}
      />
    </Group>
  );
  const onset = (
    <Group label={tr("drOnset")} tag={filters.onset && notApplied}>
      <Choices<"0" | "1">
        options={[
          ["0", tr("drOff")],
          ["1", tr("drOn")],
        ]}
        value={filters.onset ? "1" : "0"}
        onPick={(v) => change({ onset: v === "1" })}
      />
    </Group>
  );

  // Laptop: every filter in one wrapping row. Phone: the patient's own filters stay open under a one-line
  // summary so the list is in view while choosing; unit, specimen, period and day 3 sit behind "More filters".
  if (wide) {
    return (
      <form className="rs glass ply-2" aria-label={tr("drRecord")} onSubmit={(e) => e.preventDefault()}>
        <div className="rs-body">
          {unit}
          {site}
          {sex}
          {severity}
          {period}
          {age}
          {onset}
        </div>
      </form>
    );
  }
  return (
    <form className="rs glass ply-2" aria-label={tr("drRecord")} onSubmit={(e) => e.preventDefault()}>
      <div className="rs-sumrow">
        <p className="rs-sum" aria-live="polite">
          <span className="rs-sum-label">{tr("drFilters")}</span> {summary}
        </p>
      </div>
      <div className="rs-body">
        {sex}
        {age}
        {severity}
      </div>
      <button type="button" className="rs-morebtn" aria-expanded={more} aria-controls="rs-more" onClick={() => setMore(!more)}>
        {more ? tr("drFewerFilters") : tr("drMoreFilters")} <span aria-hidden="true">{more ? "▴" : "▾"}</span>
      </button>
      {more ? (
        <div className="rs-body rs-more" id="rs-more">
          {unit}
          {site}
          {period}
          {onset}
        </div>
      ) : null}
    </form>
  );
}
