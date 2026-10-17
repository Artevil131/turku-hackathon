import { PHENOTYPES, type Phenotype } from "@aei/domain";
import { formatDate, phenotypeName, t, wardName } from "@aei/i18n";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useAiStatus, useQuestion } from "../../ai.ts";
import { networkUnits } from "../../sites.ts";
import { Ask, AskedResults } from "../Ask.tsx";
import { AsOf } from "../AsOf.tsx";
import { type FeedProps, KINDS, type SignalKind } from "./board.ts";
import { KindGlyph } from "./feed/glyphs.tsx";
import { IncidentRow } from "./feed/IncidentRow.tsx";
import { applyFilters, groupByTime, type Incident, TIME_GROUPS, type TimeGroup } from "./feed/model.ts";
import { kindLabel } from "./feed/names.ts";
import type { Spans } from "./feed/spans.ts";
import type { IncidentLoad } from "./feed/useIncidents.ts";
import "./SignalFeed.css";

// The researcher's signal list (signals-redesign.md): one line per signal, grouped by time
// relative to the clock (this week, this month, earlier), one Filter button whose choices
// show as removable chips. The selected row opens; the card holds the rest.

interface Props extends FeedProps {
  load: IncidentLoad;
  incidents: Incident[];
  retry: () => void;
  spansOf: (i: Incident) => Spans | null;
  /** The incident the math panel shows. */
  selected: string | null;
}

const GROUP_KEY: Record<TimeGroup, "feedGroupWeek" | "feedGroupMonth" | "feedGroupEarlier"> = {
  week: "feedGroupWeek",
  month: "feedGroupMonth",
  earlier: "feedGroupEarlier",
};

const SHOWN_KINDS = KINDS.filter((k) => k !== "divergence");

/** Brings a workspace window into view and flashes it once, as "n more in the list" does for this list. */
function raiseWindow(id: string, reducedMotion: boolean) {
  const win = document.getElementById(id);
  if (!win) {
    document.getElementById("ws-tray-button")?.click();
    return;
  }
  win.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  win.classList.add("ws-flash");
  setTimeout(() => win.classList.remove("ws-flash"), 1200);
  win.querySelector<HTMLElement>(".sig-title, h2")?.focus?.({ preventScroll: true });
}

export function SignalFeed(props: Props) {
  const {
    client,
    locale,
    asOf,
    state,
    onChange,
    load,
    incidents,
    retry,
    spansOf,
    selected,
    kin = [],
    hasSelection = false,
    reducedMotion,
  } = props;
  const rootRef = useRef<HTMLElement>(null);

  // The Ask field appears when the API reports the assistant answering (Meta.aiStatus "ready"); while
  // a configured model is offline one line says so, and the field returns by itself (D-049).
  const { status: ai, recheck } = useAiStatus(client);
  // The model only returns filters; the unit filter also drives the board, the counts come from records.
  const question = useQuestion(client, ai, asOf, state.unit ? { ward: state.unit } : {}, (f) => {
    if ("ward" in f) onChange({ unit: f.ward ?? null });
  });
  // A failed question made the server probe the model again; read its answer.
  useEffect(() => {
    if (question.error) recheck();
  }, [question.error, recheck]);

  const filters = { unit: state.unit, kinds: state.kinds, phenotype: state.phenotype };
  const shown = applyFilters(incidents, filters);
  const readyAsOf = load.status === "ready" ? load.asOf : null;
  const groups = readyAsOf ? groupByTime(shown, readyAsOf) : null;

  // Facet counts: each choice counts the incidents the other filters leave.
  const unitCounts = countBy(applyFilters(incidents, filters, "unit"), (i) => (i.ward ? [i.ward] : []));
  const kindCounts = countBy(applyFilters(incidents, filters, "kind"), (i) => [i.kind]);
  const phenoCounts = countBy(applyFilters(incidents, filters, "phenotype"), (i) => i.phenotypes);
  const units = networkUnits([]).filter((c) => unitCounts.has(c) || state.unit === c);
  const phenotypes = [...new Set<Phenotype>([...phenoCounts.keys(), ...(state.phenotype ? [state.phenotype] : [])])]
    .filter((p) => PHENOTYPES.includes(p))
    .sort();
  const toggleKind = (k: SignalKind) =>
    onChange({ kinds: state.kinds.includes(k) ? state.kinds.filter((x) => x !== k) : [...state.kinds, k] });

  const active: { key: string; label: string; clear: () => void }[] = [
    ...(state.unit !== null ? [{ key: "unit", label: wardName(locale, state.unit), clear: () => onChange({ unit: null }) }] : []),
    ...state.kinds.map((k) => ({ key: `kind-${k}`, label: kindLabel(locale, k), clear: () => toggleKind(k) })),
    ...(state.phenotype !== null ? [{ key: "ph", label: phenotypeName(state.phenotype), clear: () => onChange({ phenotype: null }) }] : []),
  ];
  const clearAll = () => onChange({ unit: null, kinds: [], phenotype: null });

  // The selected row stays in view when a filter or a link moves it.
  const filterKey = `${state.unit}|${state.kinds.join(",")}|${state.phenotype}|${load.status}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when the filters or the selection change, not on every render.
  useEffect(() => {
    if (!selected || !state.incident) return;
    const id = requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>('.feed-row[aria-current="true"]')?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(id);
  }, [filterKey, selected]);

  return (
    <section
      ref={rootRef}
      className={`feed${hasSelection ? " has-selection" : ""}`}
      aria-labelledby="feed-title"
      aria-busy={load.status === "loading"}
    >
      <header className="feed-header">
        <div className="feed-headline">
          <h1 id="feed-title">{t(locale, "feedTitle")}</h1>
          {readyAsOf ? (
            <>
              <AsOf locale={locale} date={readyAsOf} pending={asOf !== null && asOf !== readyAsOf} clockDate={asOf ?? undefined} />
              <FilterButton locale={locale} count={active.length}>
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
            </>
          ) : null}
        </div>
        {question.available || question.offline || question.active || question.error ? (
          <div className="feed-ask">
            <Ask locale={locale} question={question} />
            {question.active ? (
              <AskedResults
                locale={locale}
                records={question.records}
                loading={question.loading}
                error={question.loadError}
                asOf={question.answer?.asOf}
              />
            ) : null}
          </div>
        ) : null}
        {active.length > 0 ? (
          <ul className="feed-active" aria-label={t(locale, "feedFilters")}>
            {active.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  className="feed-active-chip"
                  aria-label={t(locale, "feedRemoveFilter", { filter: a.label })}
                  onClick={a.clear}
                >
                  {a.label}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
            {active.length > 1 ? (
              <li>
                <button type="button" className="link feed-active-clear" onClick={clearAll}>
                  {t(locale, "feedClearFilters")}
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </header>

      <div className="feed-scroll">
        {load.status === "loading" ? (
          <ul className="feed-list">
            {[0, 1, 2, 3].map((n) => (
              <li key={n} className="feed-skeleton" aria-hidden="true">
                <span />
                <span />
              </li>
            ))}
          </ul>
        ) : load.status === "error" ? (
          <div className="feed-state" role="alert">
            <p>{t(locale, "feedError")}</p>
            <button type="button" className="feed-btn" onClick={retry}>
              {t(locale, "retry")}
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="feed-state" role="status">
            {t(locale, "feedEmpty", { date: formatDate(locale, load.asOf, "long") })}
          </p>
        ) : groups ? (
          TIME_GROUPS.filter((g) => groups[g].length > 0).map((g) => {
            const title = t(locale, GROUP_KEY[g], { n: groups[g].length });
            return (
              <section key={g} className="feed-group" aria-label={title}>
                <h2 className="feed-group-title">{title}</h2>
                <ul className="feed-list">
                  {groups[g].map((i) => (
                    <li key={i.key}>
                      <IncidentRow
                        locale={locale}
                        incident={i}
                        selected={selected === i.key}
                        kin={hasSelection && selected !== i.key && i.ward !== null && kin.includes(i.ward)}
                        spans={spansOf(i)}
                        onSelect={(key) => onChange({ incident: key })}
                        onOpenCard={() => raiseWindow("ws-win-math", reducedMotion)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        ) : null}
      </div>
    </section>
  );
}

/**
 * The one filter control: a button that opens a compact popover. Enter or Space opens it, Escape or an
 * outside click closes it and focus returns to the button; the fields inside are ordinary form controls.
 */
function FilterButton({ locale, count, children }: { locale: FeedProps["locale"]; count: number; children: ReactNode }) {
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
