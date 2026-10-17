import { t } from "@aei/i18n";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { currentHospitalName } from "../../sites.ts";
import { hashParams, subscribeHash, writeHashParams } from "../../url.ts";
import { Assistant } from "./assistant/Assistant.tsx";
import { type BoardState, boardFromUrl, boardToParams, type FeedProps } from "./board.ts";
import { ChartForm } from "./charts/ChartForm.tsx";
import { ChartWindow } from "./charts/ChartWindow.tsx";
import type { ChartSpec } from "./charts/spec.ts";
import { applyFilters } from "./feed/model.ts";
import { unitLabel } from "./feed/names.ts";
import { computeSpans, useRelations } from "./feed/spans.ts";
import { useIncidents } from "./feed/useIncidents.ts";
import { GeoMap } from "./geo/GeoMap.tsx";
import { UnitGraph } from "./geo/UnitGraph.tsx";
import { AlertMath } from "./math/AlertMath.tsx";
import { ProjectControls } from "./projects/ProjectControls.tsx";
import { type NotebookLanguage, Reproduce, ReproduceHost } from "./projects/Reproduce.tsx";
import { useProject } from "./projects/useProject.ts";
import { SignalFeed } from "./SignalFeed.tsx";
import type { Cell } from "./tools/model.ts";
import { ToolsWindow } from "./tools/ToolsWindow.tsx";
import { UnitGrid } from "./UnitGrid.tsx";
import type { WinId } from "./workspace/layout.ts";
import { type ChartRequest, Workspace } from "./workspace/Workspace.tsx";
import "./ResearchBoard.css";

// The researcher's workspace (spec-v2 5, with Artem's corrections): the
// incident list on the left, the geographic panel or the unit grid in the
// centre, the alert math on the right, all linked through one state that
// lives in the URL. Under 1100 px the three stack: list, math, panel.
// Choosing a signal opens the alert math again if it was closed.

type Props = Omit<FeedProps, "state" | "onChange">;

/** The windows that answer a selected signal next: where its unit's patients go, and the region around it. */
const ANSWERS: readonly WinId[] = ["graph", "map"];

export function ResearchBoard(props: Props) {
  const { locale, client, asOf, findings, acknowledge, command } = props;
  const [state, setState] = useState<BoardState>(boardFromUrl);
  const onChange = useCallback((patch: Partial<BoardState>) => setState((s) => ({ ...s, ...patch })), []);
  // The project (the friend's shell, D-057 on main) travels in the hash beside the board's own params.
  const project = useProject(client, asOf);
  const [notebookLanguage, setNotebookLanguage] = useState<NotebookLanguage>("python");
  useEffect(() => writeHashParams({ ...boardToParams(state), project: hashParams().get("project") }), [state]);
  // A link followed inside the app (or the back button) changes the hash without remounting.
  // Also when another component (the timeline's pills and lanes) writes `inc=` or `unit=` through url.ts.
  useEffect(() => {
    const onHash = () =>
      setState((s) => {
        const next = boardFromUrl();
        return JSON.stringify(boardToParams(s)) === JSON.stringify(boardToParams(next)) ? s : next;
      });
    return subscribeHash(onHash);
  }, []);

  // "Show on map" (the signal card): reveal the map window and select the site's county in it. The county is
  // cleared when another incident is chosen, so the next click selects it again.
  const [mapCounty, setMapCounty] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ id: WinId; key: string | null }>({ id: "math", key: state.incident });
  const mapClicks = useRef(0);
  useEffect(() => {
    setReveal({ id: "math", key: state.incident });
    setMapCounty(null);
  }, [state.incident]);
  const showMap = useCallback((county: string) => {
    setMapCounty(county);
    setReveal({ id: "map", key: `map-${++mapClicks.current}` });
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

  // The units the selected incident reaches (its span chips) are the kin of the grid and the flow.
  // Only a named selection (inc= in the URL) dims the rest; the feed's default pick does not.
  const explicit = state.incident !== null && selected?.key === state.incident;
  const kin = useMemo(() => (explicit && selected ? spansOf(selected).units : []), [explicit, selected, spansOf]);
  const panelProps = { ...props, state, onChange, kin, hasSelection: explicit };
  const loading = load.status === "loading";

  // The reading order for a selected signal: the card first, the flow and the map answer it, the rest step
  // back. Each window opens with one line saying what it answers for this signal.
  const primary: WinId | null = explicit ? "math" : null;
  const lead = useMemo<Partial<Record<WinId, string>> | undefined>(() => {
    if (!explicit || !selected) return undefined;
    const unit = unitLabel(locale, selected.ward);
    return {
      math: t(locale, "wsLeadMath"),
      signals: t(locale, "wsLeadSignals"),
      map: t(locale, "wsLeadMap", { hospital: currentHospitalName(locale) }),
      graph: t(locale, "wsLeadGraph", { unit }),
      grid: t(locale, "wsLeadGrid", { unit }),
      assistant: t(locale, "wsLeadAssistant"),
    };
  }, [explicit, selected, locale]);

  // The Tools window's frame follows the selected signal: the window its relations cover.
  const selectedSpans = explicit && selected ? spansOf(selected) : null;
  const signalWindow = selectedSpans?.from && selectedSpans.to ? { from: selectedSpans.from, to: selectedSpans.to } : null;

  // Charts: "Add as chart" and the tray form add a window; a clicked period becomes the Tools slice (the latest
  // of that and the selected signal's window wins), a clicked unit is selected in the board.
  const [chartRequest, setChartRequest] = useState<ChartRequest | null>(null);
  const chartKeys = useRef(0);
  const addChart = useCallback((spec: ChartSpec) => setChartRequest({ key: ++chartKeys.current, spec }), []);
  const [cells, setCells] = useState<Cell[]>([]);
  const [picked, setPicked] = useState<{ from: string; to: string } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new signal replaces a picked period.
  useEffect(() => setPicked(null), [state.incident]);
  const toolsWindow = picked ?? signalWindow;

  const content: Record<WinId, ReactNode> = {
    signals: (
      <SignalFeed {...panelProps} load={load} incidents={incidents} retry={retry} spansOf={spansOf} selected={selected?.key ?? null} />
    ),
    reproduce: (
      <Reproduce locale={locale} project={project.response?.project} language={notebookLanguage} onLanguage={setNotebookLanguage} />
    ),
    map: <GeoMap {...panelProps} focusCounty={mapCounty} />,
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
        asOf={asOf}
        command={command}
        onShowMap={showMap}
        empty={loading ? "loading" : "pick"}
      />
    ),
    assistant: (
      <Assistant client={client} locale={locale} incident={selected} spans={selected ? spansOf(selected) : null} waiting={loading} />
    ),
    tools: <ToolsWindow {...panelProps} window={toolsWindow} onAddChart={addChart} onCells={setCells} />,
  };

  // The URL's `panel` follows the last of the map and the unit grid that was opened or closed.
  const initiallyOpen = useRef<WinId[] | undefined>(state.panel === "grid" ? ["grid"] : undefined);
  return (
    <div className="section board">
      <Workspace
        locale={locale}
        content={content}
        initiallyOpen={initiallyOpen.current}
        reveal={reveal}
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
        primary={primary}
        answers={ANSWERS}
        lead={lead}
        chartRequest={chartRequest}
        chartContent={(_id, spec) => (
          <ChartWindow
            client={client}
            locale={locale}
            asOf={asOf}
            spec={spec}
            onPeriod={(f) => setPicked(f)}
            onUnit={(unit) => onChange({ unit: unit as never })}
          />
        )}
        chartMenu={(done) => (
          <ChartForm
            locale={locale}
            cells={cells}
            unit={state.unit ?? ""}
            phenotype={state.phenotype ?? ""}
            onAdd={(spec) => {
              addChart(spec);
              done();
            }}
          />
        )}
        onOpened={(id) => (id === "grid" ? onChange({ panel: "grid" }) : id === "map" ? onChange({ panel: "geo" }) : undefined)}
        onClosed={(id) => (id === "grid" ? onChange({ panel: "geo" }) : undefined)}
      />
    </div>
  );
}
