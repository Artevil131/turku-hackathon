import { formatDate, phenotypeName, t, wardName } from "@aei/i18n";
import { type ReactNode, useEffect, useRef } from "react";
import { useAiStatus, useQuestion } from "../../ai.ts";
import { Ask, AskedResults } from "../Ask.tsx";
import { AsOf } from "../AsOf.tsx";
import type { FeedProps, SignalKind } from "./board.ts";
import { IncidentRow } from "./feed/IncidentRow.tsx";
import { applyFilters, groupByTime, type Incident, TIME_GROUPS, type TimeGroup } from "./feed/model.ts";
import { kindLabel } from "./feed/names.ts";
import type { Spans } from "./feed/spans.ts";
import type { IncidentLoad } from "./feed/useIncidents.ts";
import "./SignalFeed.css";

// The researcher's signal list (signals-redesign.md): one line per signal, grouped by time
// relative to the clock (this week, this month, earlier), one Filter button whose choices
// show as removable chips. A selected signal (inc= in the URL, from a row, a pill or the map)
// opens the signal card as a layer in this same window: the list slides left, the card slides
// in with a Back control; Escape or Back returns to the list and clears the selection.

interface Props extends FeedProps {
  load: IncidentLoad;
  incidents: Incident[];
  retry: () => void;
  spansOf: (i: Incident) => Spans | null;
  /** The incident the math panel shows. */
  selected: string | null;
  /** The signal card, rendered as the layer over the list while `layer` is true. */
  card?: ReactNode;
  layer?: boolean;
  /** Back from the card layer: clears the selection. */
  onBack?: () => void;
  /** The URL names a signal that is not among those up to the clock: kept, not replaced by another. */
  outside?: boolean;
}

const GROUP_KEY: Record<TimeGroup, "feedGroupWeek" | "feedGroupMonth" | "feedGroupEarlier"> = {
  week: "feedGroupWeek",
  month: "feedGroupMonth",
  earlier: "feedGroupEarlier",
};

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
    card,
    layer = false,
    onBack,
    outside = false,
  } = props;
  const rootRef = useRef<HTMLElement>(null);

  // The layer: Escape anywhere outside a popover goes back to the list; opening it moves focus to the card's
  // heading, closing it returns focus to the row that was open.
  const wasLayer = useRef(layer);
  useEffect(() => {
    if (wasLayer.current === layer) return;
    wasLayer.current = layer;
    const root = rootRef.current;
    if (!root) return;
    const target = layer
      ? root.querySelector<HTMLElement>(".feed-pane-card .sig-title, .feed-pane-card .sig-back")
      : root.querySelector<HTMLElement>('.feed-row[aria-current="true"] .feed-row-main, .feed-row .feed-row-main');
    // preventScroll: a focus into the sliding pane would scroll the overflow-hidden stack sideways mid-slide.
    target?.focus({ preventScroll: true });
    root.scrollLeft = 0;
    for (const el of root.querySelectorAll<HTMLElement>(".feed-stack, .feed-pane")) el.scrollLeft = 0;
  }, [layer]);
  useEffect(() => {
    if (!layer || !onBack) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest(".ws-pop, .info, .feed-pop, .geo-detail, dialog")) return;
      if (!rootRef.current?.contains(el) && el !== document.body && el !== null) return;
      e.preventDefault();
      onBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [layer, onBack]);

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

  const listHidden = layer && card !== undefined;
  return (
    <section
      ref={rootRef}
      className={`feed${hasSelection ? " has-selection" : ""}`}
      aria-labelledby="feed-title"
      aria-busy={load.status === "loading"}
    >
      <div className="feed-stack" data-layer={listHidden ? "card" : "list"}>
        <div className="feed-pane feed-pane-list" inert={listHidden || undefined} aria-hidden={listHidden || undefined}>
          <header className="feed-header">
            <div className="feed-headline">
              <h1 id="feed-title">{t(locale, "feedTitle")}</h1>
              {readyAsOf ? (
                <AsOf locale={locale} date={readyAsOf} pending={asOf !== null && asOf !== readyAsOf} clockDate={asOf ?? undefined} />
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
            {outside ? (
              <p className="feed-outside" role="status">
                {t(locale, "feedOutside")}{" "}
                <button type="button" className="link" onClick={() => onChange({ incident: null })}>
                  {t(locale, "feedOutsideClear")}
                </button>
              </p>
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
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            ) : null}
          </div>
        </div>
        {card !== undefined ? (
          <div className="feed-pane feed-pane-card" inert={!listHidden || undefined} aria-hidden={!listHidden || undefined}>
            {listHidden ? card : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
