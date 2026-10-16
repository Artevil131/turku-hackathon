import type { Severity } from "@aei/contract";
import type { Sex, Specimen, WardCode } from "@aei/domain";
import { type Locale, type MessageKey, specimenName, t, wardName } from "@aei/i18n";
import type { ReactNode } from "react";
import { AGE_GROUPS, AGE_KEYS, type AgeGroup, type DoctorFilters, type Period, SITES, unitGroups } from "./filters.ts";
import { useMedia } from "./useMedia.ts";
import "./RecordStrip.css";

interface Props {
  locale: Locale;
  filters: DoctorFilters;
  onChange: (patch: Partial<DoctorFilters>) => void;
}

function Group({ label, tag, children }: { label: string; tag?: string | false; children: ReactNode }) {
  return (
    <div className="rs-group" role="group" aria-label={label}>
      <span className="rs-label">
        {label}
        {tag ? <span className="rs-tag">{tag}</span> : null}
      </span>
      {children}
    </div>
  );
}

function Choices<T extends string | number>(props: { options: readonly (readonly [T, string])[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="rs-choices">
      {props.options.map(([value, text]) => (
        <button key={value} type="button" className="rs-choice" aria-pressed={props.value === value} onClick={() => props.onPick(value)}>
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
  const summary = [
    wardName(locale, filters.unit),
    specimenName(locale, filters.site),
    filters.sex === "any" ? tr("drSexAny") : filters.sex,
    tr(filters.sev === "mild" ? "drSevMildShort" : "drSevSevereShort"),
    tr(filters.period === 365 ? "drPeriodYear" : "drPeriodMonth"),
  ].join(" · ");
  return (
    <form className="rs glass ply-2" aria-label={tr("drRecord")} onSubmit={(e) => e.preventDefault()}>
      <details className="rs-details" open={wide}>
        <summary>
          <span className="rs-sum-label">{tr("drFilters")}</span>
          <span className="rs-sum">{summary}</span>
        </summary>
        <div className="rs-body">
          <label className="rs-group rs-unit">
            <span className="rs-label">{tr("drUnit")}</span>
            <select className="rs-select" value={filters.unit} onChange={(e) => onChange({ unit: e.target.value as WardCode })}>
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

          <Group label={tr("drSite")}>
            <Choices<Specimen>
              options={SITES.map((s) => [s, specimenName(locale, s)] as const)}
              value={filters.site}
              onPick={(site) => onChange({ site })}
            />
          </Group>

          <Group label={tr("drSex")}>
            <Choices<Sex | "any">
              options={[
                ["any", tr("drSexAny")],
                ["F", "F"],
                ["M", "M"],
              ]}
              value={filters.sex}
              onPick={(sex) => onChange({ sex })}
            />
          </Group>

          <Group label={tr("drSeverity")}>
            <Choices<Severity>
              options={[
                ["mild", tr("drSevMild")],
                ["severe", tr("drSevSevere")],
              ]}
              value={filters.sev}
              onPick={(sev) => onChange({ sev })}
            />
          </Group>

          <Group label={tr("drPeriod")}>
            <Choices<Period>
              options={[
                [365, tr("drPeriodYear")],
                [28, tr("drPeriodMonth")],
              ]}
              value={filters.period}
              onPick={(period) => onChange({ period })}
            />
          </Group>

          <Group label={tr("drAge")} tag={filters.age !== "any" && notApplied}>
            <Choices<AgeGroup>
              options={AGE_GROUPS.map((a) => [a, tr(AGE_KEYS[a])] as const)}
              value={filters.age}
              onPick={(age) => onChange({ age })}
            />
          </Group>

          <Group label={tr("drOnset")} tag={filters.onset && notApplied}>
            <Choices<"0" | "1">
              options={[
                ["0", tr("drOff")],
                ["1", tr("drOn")],
              ]}
              value={filters.onset ? "1" : "0"}
              onPick={(v) => onChange({ onset: v === "1" })}
            />
          </Group>
        </div>
      </details>
    </form>
  );
}
