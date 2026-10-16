import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { type Locale, t } from "../i18n/index.ts";
import { useIsDesktop } from "./hooks.ts";
import { Icon } from "./Icon.tsx";
import { Sheet } from "./Sheet.tsx";

/*
  Picker: choose one value from a longer list (units, organisms, antibiotics).
  The trigger is a field-like button showing the label and the chosen value.
  Phones: a bottom sheet. From 1024 px: a popover under the trigger.
  A search box appears when there are more than 8 options.
    locale       Locale
    label        string                   what is being chosen ("Unit")
    value        T | null
    groups       { label?: string; options: PickerOption<T>[] }[]   one group without a label = a plain list
    onChange     (value: T | null) => void
    placeholder? ReactNode                trigger text when value is null
    nullLabel?   ReactNode                adds a first option that sets null ("All units", "Any")
    renderValue? (option) => ReactNode    custom trigger text
    icon?        IconName-like leading node for the trigger
    compact?     boolean                  trigger without the label line (label stays as aria-label)
    variant?     "field" (default) | "chip"   chip = a pill "Label: value" for filter rows
    disabled?    boolean
  PickerOption<T>: { value: T; label: ReactNode; text?: string (for search; defaults to label when a string);
                     hint?: ReactNode (right-aligned, e.g. a count); disabled?: boolean }
*/

export interface PickerOption<T extends string> {
  value: T;
  label: ReactNode;
  text?: string;
  hint?: ReactNode;
  disabled?: boolean;
}

export interface PickerGroup<T extends string> {
  label?: string;
  options: readonly PickerOption<T>[];
}

const NULL = "\u0000null";

export function Picker<T extends string>({
  locale,
  label,
  value,
  groups,
  onChange,
  placeholder,
  nullLabel,
  renderValue,
  icon,
  compact = false,
  variant = "field",
  disabled = false,
}: {
  locale: Locale;
  label: string;
  value: T | null;
  groups: readonly PickerGroup<T>[];
  onChange: (value: T | null) => void;
  placeholder?: ReactNode;
  nullLabel?: ReactNode;
  renderValue?: (option: PickerOption<T>) => ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  variant?: "field" | "chip";
  disabled?: boolean;
}) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const all = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const chosen = value === null ? undefined : all.find((o) => o.value === value);
  const searchable = all.length > 8;

  const textOf = (o: PickerOption<T>) => (o.text ?? (typeof o.label === "string" ? o.label : String(o.value))).toLowerCase();
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, options: q ? g.options.filter((o) => textOf(o).includes(q)) : g.options }))
        .filter((g) => g.options.length > 0),
    [groups, q],
  );

  function choose(v: T | null) {
    onChange(v);
    close();
  }
  function close() {
    setOpen(false);
    setQuery("");
    if (desktop) triggerRef.current?.focus();
  }

  // Desktop popover: close on outside press and Esc; focus the chosen option on open.
  useEffect(() => {
    if (!open || !desktop) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", onDown);
    const first =
      popRef.current?.querySelector<HTMLElement>(".k-pick-search input") ??
      popRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      popRef.current?.querySelector<HTMLElement>(".k-pick-opt");
    first?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, desktop]);

  function onListKey(e: KeyboardEvent<HTMLElement>) {
    const root = e.currentTarget;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".k-pick-opt:not(:disabled)"));
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[Math.min(items.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i <= 0) root.querySelector<HTMLElement>(".k-pick-search input")?.focus();
      else items[i - 1]?.focus();
    } else if (e.key === "Escape" && desktop) {
      e.preventDefault();
      close();
    }
  }

  const list = (
    <div className="k-pick-list" onKeyDown={onListKey}>
      {searchable ? (
        <label className="k-pick-search">
          <Icon name="search" size={18} />
          <span className="u-sr">{t(locale, "common.picker.search")}</span>
          <input
            type="search"
            value={query}
            placeholder={t(locale, "common.picker.search")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const firstOpt = shown[0]?.options.find((o) => !o.disabled);
                if (firstOpt) {
                  e.preventDefault();
                  choose(firstOpt.value);
                }
              }
            }}
            autoComplete="off"
            enterKeyHint="go"
          />
        </label>
      ) : null}
      <div role="listbox" id={listId} aria-label={label} className="k-pick-options">
        {nullLabel !== undefined && !q ? (
          <PickerRow selected={value === null} onPick={() => choose(null)} label={nullLabel} key={NULL} />
        ) : null}
        {shown.map((g, gi) => (
          <div role="group" aria-label={g.label} key={g.label ?? gi} className="k-pick-group">
            {g.label ? (
              <div className="k-pick-group-label" aria-hidden="true">
                {g.label}
              </div>
            ) : null}
            {g.options.map((o) => (
              <PickerRow
                key={o.value}
                selected={o.value === value}
                onPick={() => choose(o.value)}
                label={o.label}
                hint={o.hint}
                disabled={o.disabled}
              />
            ))}
          </div>
        ))}
        {shown.length === 0 ? <p className="k-pick-empty">{t(locale, "common.picker.noMatch")}</p> : null}
      </div>
    </div>
  );

  const valueNode = chosen
    ? renderValue
      ? renderValue(chosen)
      : chosen.label
    : value === null && nullLabel !== undefined
      ? nullLabel
      : placeholder;

  return (
    <div className={`k-pick${open ? " is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`k-pick-trigger${compact ? " is-compact" : ""}${variant === "chip" ? " is-chip" : ""}${value !== null ? " has-value" : ""}`}
        aria-haspopup={desktop ? "listbox" : "dialog"}
        aria-expanded={open}
        aria-label={compact ? label : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {icon ? <span className="k-pick-icon">{icon}</span> : null}
        <span className="k-pick-texts">
          {compact ? null : <span className="k-pick-label">{label}</span>}
          <span className="k-pick-value">{valueNode}</span>
        </span>
        <Icon name="chevron-down" size={18} className="k-pick-chev" />
      </button>
      {open && desktop ? (
        <div ref={popRef} className="k-pop" role="dialog" aria-label={label}>
          {list}
        </div>
      ) : null}
      {!desktop ? (
        <Sheet
          open={open}
          onClose={close}
          title={label}
          locale={locale}
          size="sm"
          initialFocus={searchable ? ".k-pick-search input" : '[aria-selected="true"]'}
        >
          {list}
        </Sheet>
      ) : null}
    </div>
  );
}

function PickerRow({
  selected,
  onPick,
  label,
  hint,
  disabled,
}: {
  selected: boolean;
  onPick: () => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`k-pick-opt${selected ? " is-on" : ""}`}
      onClick={onPick}
      disabled={disabled}
    >
      <span className="k-pick-opt-label">{label}</span>
      {hint !== undefined ? <span className="k-pick-opt-hint u-num">{hint}</span> : null}
      <Icon name="check" size={18} className="k-pick-opt-check" />
    </button>
  );
}
