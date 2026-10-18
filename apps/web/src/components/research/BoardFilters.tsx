import { PHENOTYPES, type Phenotype } from "@aei/domain";
import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { networkUnits } from "../../sites.ts";
import { type BoardState, KINDS, type SignalKind } from "./board.ts";
import { KindGlyph } from "./feed/glyphs.tsx";
import { applyFilters, type Incident } from "./feed/model.ts";
import { kindLabel } from "./feed/names.ts";
import "./BoardFilters.css";

const SHOWN_KINDS = KINDS.filter((k) => k !== "divergence");

export interface FilterCounts {
  unit: Map<string, number>;
  kind: Map<SignalKind, number>;
  phenotype: Map<Phenotype, number>;
}

/** Facet counts: each choice counts the incidents the other filters leave. */
export function filterCounts(incidents: readonly Incident[], state: Pick<BoardState, "unit" | "kinds" | "phenotype">): FilterCounts {
  const filters = { unit: state.unit, kinds: state.kinds, phenotype: state.phenotype };
  return {
    unit: countBy(applyFilters(incidents, filters, "unit"), (i) => (i.ward ? [i.ward] : [])),
    kind: countBy(applyFilters(incidents, filters, "kind"), (i) => [i.kind]),
    phenotype: countBy(applyFilters(incidents, filters, "phenotype"), (i) => i.phenotypes),
  };
}

/**
 * The board's filters (unit, signal kind, resistance phenotype) as one toolbar button with a popover. The choices
 * write through `onChange` into the board state (and so the URL); the signal list shows them as chips.
 */
export function BoardFilters({
  locale,
  state,
  onChange,
  counts,
}: {
  locale: Locale;
  state: Pick<BoardState, "unit" | "kinds" | "phenotype">;
  onChange: (patch: Partial<BoardState>) => void;
  counts: FilterCounts;
}) {
  const unitCounts = counts.unit;
  const kindCounts = counts.kind;
  const phenoCounts = counts.phenotype;
  const units = networkUnits([]).filter((c) => unitCounts.has(c) || state.unit === c);
  const phenotypes = [...new Set<Phenotype>([...phenoCounts.keys(), ...(state.phenotype ? [state.phenotype] : [])])]
    .filter((p) => PHENOTYPES.includes(p))
    .sort();
  const toggleKind = (k: SignalKind) =>
    onChange({ kinds: state.kinds.includes(k) ? state.kinds.filter((x) => x !== k) : [...state.kinds, k] });
  const count = (state.unit !== null ? 1 : 0) + state.kinds.length + (state.phenotype !== null ? 1 : 0);
  return (
    <FilterButton locale={locale} count={count}>
      <label className="feed-pop-field">
        <span>{t(locale, "feedFilterUnit")}</span>
        <select
          className="feed-select"
          value={state.unit ?? ""}
          onChange={(e) => onChange({ unit: (e.target.value || null) as typeof state.unit })}
        >
          <option value="">{t(locale, "feedAllUnits")}</option>
          {units.map((c) => (
            <option key={c} value={c}>
              {wardName(locale, c)} · {unitCounts.get(c) ?? 0}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="feed-pop-kinds">
        <legend>{t(locale, "feedFilterKind")}</legend>
        {SHOWN_KINDS.map((k) => (
          <label key={k} className="feed-pop-kind">
            <input type="checkbox" checked={state.kinds.includes(k)} onChange={() => toggleKind(k)} />
            <KindGlyph kind={k} />
            <span className="feed-pop-kind-name">{kindLabel(locale, k)}</span>
            <span className="feed-pop-count">{kindCounts.get(k) ?? 0}</span>
          </label>
        ))}
      </fieldset>
      <label className="feed-pop-field">
        <span>{t(locale, "feedFilterPhenotype")}</span>
        <select
          className="feed-select"
          value={state.phenotype ?? ""}
          onChange={(e) => onChange({ phenotype: (e.target.value || null) as Phenotype | null })}
        >
          <option value="">{t(locale, "feedAllPhenotypes")}</option>
          {phenotypes.map((p) => (
            <option key={p} value={p}>
              {phenotypeName(p)} · {phenoCounts.get(p) ?? 0}
            </option>
          ))}
        </select>
      </label>
    </FilterButton>
  );
}

/**
 * The one filter control: a button that opens a compact popover. Enter or Space opens it, Escape or an
 * outside click closes it and focus returns to the button; the fields inside are ordinary form controls.
 */
function FilterButton({ locale, count, children }: { locale: Locale; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return (
    <div className="feed-filter-wrap" ref={root}>
      <button
        type="button"
        ref={button}
        className="feed-filter"
        data-active={count > 0}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <FilterGlyph />
        {count > 0 ? t(locale, "feedFilterN", { n: count }) : t(locale, "feedFilter")}
      </button>
      {open ? (
        <div className="feed-pop" id={id} role="dialog" aria-label={t(locale, "feedFilters")}>
          {children}
          <button
            type="button"
            className="feed-btn feed-pop-done"
            onClick={() => {
              setOpen(false);
              button.current?.focus();
            }}
          >
            {t(locale, "feedFilterDone")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FilterGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M2.5 4h11M4.5 8h7M6.5 12h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function countBy<T extends string>(list: readonly Incident[], keys: (i: Incident) => T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of list) for (const k of new Set(keys(i))) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}
