import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { writeHashParams } from "../../url.ts";
import { Assistant } from "./assistant/Assistant.tsx";
import { type BoardState, boardFromUrl, boardToParams, type FeedProps } from "./board.ts";
import { applyFilters } from "./feed/model.ts";
import { computeSpans, useRelations } from "./feed/spans.ts";
import { useIncidents } from "./feed/useIncidents.ts";
import { GeoMap } from "./geo/GeoMap.tsx";
import { UnitGraph } from "./geo/UnitGraph.tsx";
import { AlertMath } from "./math/AlertMath.tsx";
import { SignalFeed } from "./SignalFeed.tsx";
import { UnitGrid } from "./UnitGrid.tsx";
import type { WinId } from "./workspace/layout.ts";
import { Workspace } from "./workspace/Workspace.tsx";
import "./ResearchBoard.css";

// The researcher's workspace (spec-v2 5, with Artem's corrections): the
// incident list on the left, the geographic panel or the unit grid in the
// centre, the alert math on the right, all linked through one state that
// lives in the URL. Under 1100 px the three stack: list, math, panel.
// Choosing a signal opens the alert math again if it was closed.

type Props = Omit<FeedProps, "state" | "onChange">;

export function ResearchBoard(props: Props) {
  const { locale, client, asOf, findings, acknowledge } = props;
  const [state, setState] = useState<BoardState>(boardFromUrl);
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
  const loading = load.status === "loading";

  const content: Record<WinId, ReactNode> = {
    signals: (
      <SignalFeed {...panelProps} load={load} incidents={incidents} retry={retry} spansOf={spansOf} selected={selected?.key ?? null} />
    ),
    map: <GeoMap {...panelProps} />,
    graph: <UnitGraph {...panelProps} />,
    grid: <UnitGrid {...panelProps} />,
    math: (
      <AlertMath
        client={client}
        locale={locale}
        incident={selected}
        spans={selected ? spansOf(selected) : null}
        findings={findings}
        onChange={onChange}
        acknowledge={acknowledge}
        empty={loading ? "loading" : "pick"}
      />
    ),
    assistant: (
      <Assistant client={client} locale={locale} incident={selected} spans={selected ? spansOf(selected) : null} waiting={loading} />
    ),
  };

  // The URL's `panel` follows the last of the map and the unit grid that was opened or closed.
  const initiallyOpen = useRef<WinId[] | undefined>(state.panel === "grid" ? ["grid"] : undefined);
  return (
    <div className="section board">
      <Workspace
        locale={locale}
        content={content}
        initiallyOpen={initiallyOpen.current}
        reveal={{ id: "math", key: state.incident }}
        onOpened={(id) => (id === "grid" ? onChange({ panel: "grid" }) : id === "map" ? onChange({ panel: "geo" }) : undefined)}
        onClosed={(id) => (id === "grid" ? onChange({ panel: "geo" }) : undefined)}
      />
    </div>
  );
}
