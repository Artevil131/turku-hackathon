import { t } from "@aei/i18n";
import { type KeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { writeHashParams } from "../../url.ts";
import { type BoardState, boardFromUrl, boardToParams, type FeedProps, PANELS, type Panel } from "./board.ts";
import { applyFilters } from "./feed/model.ts";
import { computeSpans, useRelations } from "./feed/spans.ts";
import { useIncidents } from "./feed/useIncidents.ts";
import { GeoMap } from "./geo/GeoMap.tsx";
import { AlertMath } from "./math/AlertMath.tsx";
import { SignalFeed } from "./SignalFeed.tsx";
import { UnitGrid } from "./UnitGrid.tsx";
import "./ResearchBoard.css";

// The researcher's workspace (spec-v2 5, with Artem's corrections): the
// incident list on the left, the geographic panel or the unit grid in the
// centre, the alert math on the right, all linked through one state that
// lives in the URL. Under 1100 px the three stack: list, math, panel.

type Props = Omit<FeedProps, "state" | "onChange">;

const PANEL_LABEL = { geo: "boardGeo", grid: "boardGrid" } as const;

/** One screen: the board takes what is left under the top bar and the timeline (which changes height), less the page gutter. */
function useFitHeight(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = "";
    const fit = () => {
      if (!window.matchMedia("(min-width: 1100px)").matches) {
        last = "";
        return el.style.removeProperty("--board-h");
      }
      const next = `${Math.max(420, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 12 + window.scrollY))}px`;
      // Only a real change is written: rewriting the same height re-triggers layout observers.
      if (next !== last) {
        last = next;
        el.style.setProperty("--board-h", next);
      }
    };
    fit();
    // Watch only what decides the board's top: the window and the timeline above it (never the
    // page itself, whose height the board sets; that loop hung the browser).
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    const timeline = document.querySelector(".timeline");
    if (timeline) ro.observe(timeline);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [ref]);
}

export function ResearchBoard(props: Props) {
  const { locale, client, asOf, findings, acknowledge } = props;
  const [state, setState] = useState<BoardState>(boardFromUrl);
  const boardRef = useRef<HTMLDivElement>(null);
  useFitHeight(boardRef);
  const onChange = useCallback((patch: Partial<BoardState>) => setState((s) => ({ ...s, ...patch })), []);
  useEffect(() => writeHashParams(boardToParams(state)), [state]);
  // A link followed inside the app (or the back button) changes the hash without remounting.
  useEffect(() => {
    const onHash = () => setState(boardFromUrl());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const { load, incidents, retry } = useIncidents(client, asOf);
  const shown = useMemo(
    () => applyFilters(incidents, { unit: state.unit, kinds: state.kinds, phenotype: state.phenotype }),
    [incidents, state.unit, state.kinds, state.phenotype],
  );
  // The named incident, else the newest one in the list; the list never leaves the math panel blank.
  const selected = useMemo(
    () => incidents.find((i) => i.key === state.incident && shown.includes(i)) ?? shown[0] ?? null,
    [incidents, shown, state.incident],
  );
  const relationsOf = useRelations(client, asOf, shown);
  const spansOf = useCallback((i: (typeof incidents)[number]) => computeSpans(i, incidents, relationsOf(i)), [incidents, relationsOf]);

  // The selected incident's unit is lit in the panels; it follows the selection.
  const selectedWard = selected?.ward ?? null;
  const ready = load.status === "ready";
  useEffect(() => {
    if (!ready) return;
    setState((s) => (s.focus === selectedWard ? s : { ...s, focus: selectedWard }));
  }, [ready, selectedWard]);

  const panelProps = { ...props, state, onChange };
  const tabRefs = useRef(new Map<Panel, HTMLButtonElement>());
  // Roving tabindex: one tab stop; arrows, Home and End move and select (the panel swap is instant).
  const onTabKey = (e: KeyboardEvent, x: Panel) => {
    const i = PANELS.indexOf(x);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % PANELS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + PANELS.length) % PANELS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = PANELS.length - 1;
    const to = next === null ? undefined : PANELS[next];
    if (to === undefined) return;
    e.preventDefault();
    onChange({ panel: to });
    tabRefs.current.get(to)?.focus();
  };

  return (
    <div className="section board" ref={boardRef}>
      <div className="board-feed">
        <SignalFeed {...panelProps} load={load} incidents={incidents} retry={retry} spansOf={spansOf} selected={selected?.key ?? null} />
      </div>
      <div className="board-main">
        <div className="board-tabs" role="tablist" aria-label={t(locale, "boardPanels")}>
          {PANELS.map((x) => (
            <button
              key={x}
              type="button"
              role="tab"
              id={`board-tab-${x}`}
              className="board-tab"
              data-panel={x}
              aria-selected={state.panel === x}
              aria-controls="board-panel-main"
              tabIndex={state.panel === x ? 0 : -1}
              ref={(el) => {
                if (el) tabRefs.current.set(x, el);
                else tabRefs.current.delete(x);
              }}
              onKeyDown={(e) => onTabKey(e, x)}
              onClick={() => onChange({ panel: x })}
            >
              {t(locale, PANEL_LABEL[x])}
            </button>
          ))}
        </div>
        <div className="board-view" id="board-panel-main" role="tabpanel" aria-labelledby={`board-tab-${state.panel}`}>
          {state.panel === "geo" ? <GeoMap {...panelProps} /> : <UnitGrid {...panelProps} />}
        </div>
      </div>
      <div className="board-math">
        <AlertMath
          client={client}
          locale={locale}
          incident={selected}
          spans={selected ? spansOf(selected) : null}
          findings={findings}
          onChange={onChange}
          acknowledge={acknowledge}
          empty={load.status === "loading" ? "loading" : "pick"}
        />
      </div>
    </div>
  );
}
