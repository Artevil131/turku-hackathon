import { type KeyboardEvent, type ReactNode, useRef } from "react";

/*
  Segmented: one choice out of a few (2 to 5), always visible. A radio group:
  arrow keys move the choice, Tab leaves the group.
    label      string                accessible name of the group (visually hidden unless showLabel)
    value      T
    options    { value: T; label: ReactNode; hint?: string; disabled?: boolean }[]
    onChange   (value: T) => void
    size?      "md" (44 px, default) | "sm" (36 px visual, 44 px hit area)
    stretch?   boolean               options share the full width (default true on phones via CSS)
    showLabel? boolean               show the label above the control
*/

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  stretch = true,
  showLabel = false,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "md" | "sm";
  stretch?: boolean;
  showLabel?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : (enabled[0] ?? 0);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key) || enabled.length === 0) return;
    e.preventDefault();
    const current = Math.max(0, enabled.indexOf(selectedIndex));
    let next = current;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % enabled.length;
    else next = (current - 1 + enabled.length) % enabled.length;
    const index = enabled[next];
    if (index === undefined) return;
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    refs.current[index]?.focus();
  }

  const group = (
    <div role="radiogroup" aria-label={label} className={`k-seg is-${size}${stretch ? " is-stretch" : ""}`} onKeyDown={onKey}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={o.disabled}
            title={o.hint}
            className={`k-seg-opt${selected ? " is-on" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  if (!showLabel) return group;
  return (
    <div className="k-field">
      <span className="k-field-label" aria-hidden="true">
        {label}
      </span>
      {group}
    </div>
  );
}
