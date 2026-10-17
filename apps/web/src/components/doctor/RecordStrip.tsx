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
      <span className="rs-label">{label}</span>
      {children}
      {tag ? <i className="rs-break" aria-hidden="true" /> : null}
      {tag ? <span className="rs-tag">{tag}</span> : null}
    </div>
  );
}

function Choices<T extends string | number>(props: {
  options: readonly (readonly [T, string, string?])[];
  value: T;
  onPick: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rs-choices">
      {props.options.map(([value, text, title]) => (
        <button
          key={value}
          type="button"
          className="rs-choice"
          title={title}
          disabled={props.disabled}
          aria-pressed={!props.disabled && props.value === value}
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
  const wide = useMedia("(min-width: 960px)");
  const [more, setMore] = useState(false);
  const change = onChange;
  const summary = [
    wardName(locale, filters.unit),
    specimenName(locale, filters.site),
    sexWord(locale, filters.sex),
    filters.age === "any" ? null : t(locale, "drPrintAge", { age: tr(AGE_KEYS[filters.age]) }),
    filters.onset ? tr("drOnsetPhone") : null,
    tr(filters.sev === "mild" ? "drSevMildShort" : "drSevSevereShort"),
    tr(filters.period === 365 ? "drPeriodYear" : "drPeriodMonth"),
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
          [365, wide ? tr("drPeriodYearShort") : tr("drPeriodYear"), tr("drPeriodYear")],
          [28, wide ? tr("drPeriodMonthShort") : tr("drPeriodMonth"), tr("drPeriodMonth")],
        ]}
        value={filters.period}
        onPick={(v) => change({ period: v })}
      />
    </Group>
  );
  const age = (
    <Group label={tr("drAge")}>
      <Choices<AgeGroup>
        options={AGE_GROUPS.map(
          (a) =>
            [
              a,
              wide && a === "any" ? tr("drAgeLabel") : tr(AGE_KEYS[a]),
              a === "any" ? `${tr("drAge")}: ${tr(AGE_KEYS.any)}` : undefined,
            ] as const,
        )}
        value={filters.age}
        onPick={(v) => onChange({ age: v })}
      />
    </Group>
  );
  const onset = (
    <Group label={tr("drOnset")}>
      <button
        type="button"
        className="rs-choice rs-toggle"
        title={tr("drOnset")}
        aria-pressed={filters.onset}
        onClick={() => change({ onset: !filters.onset })}
      >
        {wide ? tr("drOnsetShort") : tr("drOnsetPhone")}
      </button>
    </Group>
  );

  const severeBlood = (
    <button
      type="button"
      className="rs-choice rs-quick"
      aria-pressed={filters.site === "blood" && filters.sev === "severe"}
      onClick={() => {
        onChange({ site: "blood", sev: "severe" });
        setMore(false);
      }}
    >
      {tr("drSevereBlood")}
    </button>
  );

  // Keep the severe blood shortcut visible even when phone filters are collapsed.
  if (wide) {
    return (
      <form className="rs" data-wide="" aria-label={tr("drRecord")} onSubmit={(e) => e.preventDefault()}>
        <div className="rs-body">
          {unit}
          {site}
          {sex}
          {severity}
          {age}
          {onset}
          {period}
        </div>
        {severeBlood}
      </form>
    );
  }
  return (
    <form className="rs" aria-label={tr("drRecord")} onSubmit={(e) => e.preventDefault()}>
      <button type="button" className="rs-sumrow" aria-expanded={more} aria-controls="rs-more" onClick={() => setMore(!more)}>
        <span className="rs-sum" aria-live="polite">
          <span className="rs-sum-label">{tr("drFilters")}</span> {summary}
        </span>
        <span aria-hidden="true">{more ? "▴" : "▾"}</span>
      </button>
      {severeBlood}
      {more ? (
        <div className="rs-body rs-more" id="rs-more">
          {unit}
          {site}
          {sex}
          {severity}
          {age}
          {period}
          {onset}
          <button
            type="button"
            className="rs-done"
            onClick={() => {
              setMore(false);
              document.getElementById("dr-list")?.focus();
            }}
          >
            {tr("drShowList")}
          </button>
        </div>
      ) : null}
    </form>
  );
}
