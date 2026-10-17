import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hashParams, writeHashParams } from "../../url.ts";
import { CoverageWindow } from "../doctor/CoverageWindow.tsx";
import { Assistant } from "./assistant/Assistant.tsx";
import { type BoardState, boardFromUrl, boardToParams, type FeedProps } from "./board.ts";
import { applyFilters, shift } from "./feed/model.ts";
import { computeSpans, useRelations } from "./feed/spans.ts";
import { useIncidents } from "./feed/useIncidents.ts";
import { GeoMap } from "./geo/GeoMap.tsx";
import { UnitGraph } from "./geo/UnitGraph.tsx";
import { AlertMath } from "./math/AlertMath.tsx";
import { ProjectControls } from "./projects/ProjectControls.tsx";
import { type NotebookLanguage, Reproduce, ReproduceHost } from "./projects/Reproduce.tsx";
import { useProject } from "./projects/useProject.ts";
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
  const project = useProject(client, asOf);
  const [notebookLanguage, setNotebookLanguage] = useState<NotebookLanguage>("python");
  const [state, setState] = useState<BoardState>(boardFromUrl);
  const [reveal, setReveal] = useState<{ id: WinId; key: string | null }>({ id: "math", key: state.incident });
  useEffect(() => setReveal({ id: "math", key: state.incident }), [state.incident]);
  const onChange = useCallback((patch: Partial<BoardState>) => setState((s) => ({ ...s, ...patch })), []);
  useEffect(() => {
    const coverage = Object.fromEntries([...hashParams()].filter(([key]) => key.startsWith("cov.")));
    writeHashParams({ ...coverage, ...boardToParams(state), project: hashParams().get("project") });
  }, [state]);
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
    coverage: (
      <CoverageWindow
        client={client}
        locale={locale}
        asOf={asOf}
        alerts={load.status === "ready" ? load.alerts.filter((a) => a.date >= shift(load.asOf, 1 - 28)) : []}
        alertsStatus={load.status}
        onRetryAlerts={retry}
        onOpenSignals={(unit) => {
          onChange({ unit });
          setReveal({ id: "signals", key: `coverage-signals-${Date.now()}` });
        }}
      />
    ),
    signals: (
      <SignalFeed {...panelProps} load={load} incidents={incidents} retry={retry} spansOf={spansOf} selected={selected?.key ?? null} />
    ),
    reproduce: (
      <Reproduce locale={locale} project={project.response?.project} language={notebookLanguage} onLanguage={setNotebookLanguage} />
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
  // A coverage deep link opens its window even in a browser with no saved layout.
  const initiallyOpen = useRef<WinId[]>([
    ...(state.panel === "grid" ? ["grid" as const] : []),
    ...([...hashParams().keys()].some((key) => key.startsWith("cov.")) ? ["coverage" as const] : []),
  ]);
  return (
    <div className="section board">
      <Workspace
        projectId={project.id}
        project={project.response?.project}
        client={client}
        locale={locale}
        content={content}
        toolbar={
          <ProjectControls
            client={client}
            locale={locale}
            clock={asOf}
            board={state}
            selection={project}
            onReproduce={() => setReveal({ id: "reproduce", key: `reproduce-${Date.now()}` })}
          />
        }
        overlay={<ReproduceHost locale={locale} projectId={project.id} language={notebookLanguage} />}
        initiallyOpen={initiallyOpen.current}
        reveal={reveal}
        onOpened={(id) => (id === "grid" ? onChange({ panel: "grid" }) : id === "map" ? onChange({ panel: "geo" }) : undefined)}
        onClosed={(id) => (id === "grid" ? onChange({ panel: "geo" }) : undefined)}
      />
    </div>
  );
}
