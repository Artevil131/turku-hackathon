import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.tsx";

/*
  ToggleChip: one on/off filter (aria-pressed).
    pressed     boolean
    onClick     () => void
    children    ReactNode
    icon?       IconName                leading icon
    count?      number                  small trailing count (tabular)
    disabled?   boolean
    title?      string
    ariaLabel?  string                  the chip's full name when its text is abbreviated (e.g. "E. coli 49%")

  ChipGroup: pick zero or one value from a short list, as a row of chips that
  wraps. Tapping the chosen chip again clears it (when clearable). With
  `anyLabel` a leading chip stands for "no filter" and is on when value is null.
    label       string                  the group's name (shown above unless hideLabel)
    value       T | null
    options     { value: T; label: ReactNode; count?: number; disabled?: boolean }[]
    onChange    (value: T | null) => void
    clearable?  boolean                 default true
    anyLabel?   ReactNode               e.g. t(locale, "common.chip.any")
    hideLabel?  boolean
    scroll?     boolean                 one row that scrolls sideways instead of wrapping (phones)

  RemovableChip: a chip showing a chosen value with an x to remove it (Ask answers, active filters).
    label       ReactNode               what is chosen
    kind?       string                  quiet prefix ("Unit")
    onRemove    () => void
    removeLabel string                  accessible name of the x button
*/

export function ToggleChip({
  pressed,
  onClick,
  children,
  icon,
  count,
  disabled,
  title,
  ariaLabel,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: IconName;
  count?: number;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={`k-chip${pressed ? " is-on" : ""}`}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {pressed ? <Icon name="check" size={16} className="k-chip-check" /> : icon ? <Icon name={icon} size={16} /> : null}
      <span className="k-chip-text">{children}</span>
      {count !== undefined ? <span className="k-chip-count u-num">{count}</span> : null}
    </button>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  clearable = true,
  anyLabel,
  hideLabel = false,
  scroll = false,
}: {
  label: string;
  value: T | null;
  options: readonly ChipOption<T>[];
  onChange: (value: T | null) => void;
  clearable?: boolean;
  anyLabel?: ReactNode;
  hideLabel?: boolean;
  scroll?: boolean;
}) {
  return (
    <div className="k-field" role="group" aria-label={label}>
      {hideLabel ? null : (
        <span className="k-field-label" aria-hidden="true">
          {label}
        </span>
      )}
      <div className={`k-chips${scroll ? " is-scroll" : ""}`}>
        {anyLabel !== undefined ? (
          <ToggleChip pressed={value === null} onClick={() => onChange(null)}>
            {anyLabel}
          </ToggleChip>
        ) : null}
        {options.map((o) => {
          const on = o.value === value;
          return (
            <ToggleChip
              key={o.value}
              pressed={on}
              count={o.count}
              disabled={o.disabled}
              onClick={() => onChange(on ? (clearable ? null : o.value) : o.value)}
            >
              {o.label}
            </ToggleChip>
          );
        })}
      </div>
    </div>
  );
}

export function RemovableChip({
  label,
  kind,
  onRemove,
  removeLabel,
}: {
  label: ReactNode;
  kind?: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <span className="k-chip is-on is-removable">
      {kind ? <span className="k-chip-kind">{kind}</span> : null}
      <span className="k-chip-text">{label}</span>
      <button type="button" className="k-chip-x" onClick={onRemove} aria-label={removeLabel}>
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}
