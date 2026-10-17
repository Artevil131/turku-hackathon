import type { ClockCommand, ClockState } from "@aei/contract";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveAlerts } from "../../alertsSince.ts";
import type { Connection } from "../../live.ts";
import { InSlot, useShell } from "../../shell/context.ts";
import { currentSite, homeSite } from "../../sites.ts";
import { hashParams, subscribeHash, writeHashParams } from "../../url.ts";
import { CoverageWindow } from "../doctor/CoverageWindow.tsx";
import { Timeline } from "../Timeline.tsx";
import { AnswerWindow } from "./answer/AnswerWindow.tsx";
import { Assistant } from "./assistant/Assistant.tsx";
import { type BoardState, boardFromUrl, boardToParams, type FeedProps } from "./board.ts";
import { ChartForm } from "./charts/ChartForm.tsx";
import { ChartWindow } from "./charts/ChartWindow.tsx";
import type { ChartSpec } from "./charts/spec.ts";
import { applyFilters, shift } from "./feed/model.ts";
import { computeSpans, useRelations } from "./feed/spans.ts";
import { useIncidents } from "./feed/useIncidents.ts";
import { GeoMap } from "./geo/GeoMap.tsx";
import { UnitGraph } from "./geo/UnitGraph.tsx";
import { AlertMath } from "./math/AlertMath.tsx";
import type { SliceSources } from "./notebook/cells/SliceCell.tsx";
import { appendResult, pageSlot, withSite } from "./notebook/model.ts";
import { Notebook } from "./notebook/Notebook.tsx";
import { useNotebookPage } from "./notebook/usePage.ts";
import { ProjectActions } from "./projects/ProjectActions.tsx";
import { type NotebookLanguage, Reproduce } from "./projects/Reproduce.tsx";
import { useProject } from "./projects/useProject.ts";
import { SignalFeed } from "./SignalFeed.tsx";
import type { Cell, CellResult, Slice } from "./tools/model.ts";
import { ToolRail } from "./tools/ToolRail.tsx";
import { UnitGrid } from "./UnitGrid.tsx";
import type { WinId } from "./workspace/layout.ts";
import { type ChartRequest, Workspace } from "./workspace/Workspace.tsx";
import "./ResearchBoard.css";

// The researcher's workspace (spec-v2 5, with Artem's corrections): the
// Signals window large on the left, with the signal card as a layer inside it
// (a selected row goes one level deeper in the same window), the geographic
// panel in the centre, the unit graph on the right, all linked through one
// state that lives in the URL. The card's own window and the assistant stay
// in the tray as pop-outs. Under 1100 px the windows stack.

/** The replay the timeline window shows and seeks: the one global clock. */
export interface Replay {
  clock: ClockState | null;
  connection: Connection;
  lastArrivals: { to: string; count: number } | null;
  command: (c: ClockCommand) => void;
  liveAlerts: LiveAlerts;
}
type Props = Omit<FeedProps, "state" | "onChange"> & { replay: Replay };

/** The windows that answer a selected signal next: where its unit's patients go, and the region around it. */
const ANSWERS: readonly WinId[] = ["graph", "map"];

export function ResearchBoard(props: Props) {
  const { locale, client, asOf, findings, acknowledge } = props;
  const command = props.replay.command;
  const [state, setState] = useState<BoardState>(boardFromUrl);
  // Choosing the signal that is already chosen ("Open calculation and explanation" on its row) changes no
  // state, so the card is revealed by hand: opened, raised and flashed.
  const incidentRef = useRef<string | null>(state.incident);
  incidentRef.current = state.incident;
  const [explain, setExplain] = useState(0);
  const onChange = useCallback((patch: Partial<BoardState>) => {
    if (patch.incident !== undefined && patch.incident !== null && patch.incident === incidentRef.current) {
      setReveal({ id: "signals", key: `signals-${Date.now()}` });
      setExplain((n) => n + 1);
    }
    setState((s) => ({ ...s, ...patch }));
  }, []);
  // The project (the friend's shell, D-057 on main) travels in the hash beside the board's own params.
  const project = useProject(client, asOf);
  const shell = useShell();
  const current = project.response?.project ?? null;
  const drift = !!project.response?.drift;
  // The sidebar names this tab and marks it frozen from what the server says.
  useEffect(() => shell.describe({ project: current, drift }), [shell, current, drift]);
  const gone = useCallback(() => {
    if (project.id) shell.projectGone(project.id, current?.name ?? null);
  }, [shell, project.id, current?.name]);
  useEffect(() => {
    if (project.missing) gone();
  }, [project.missing, gone]);
  const [notebookLanguage, setNotebookLanguage] = useState<NotebookLanguage>("python");
  // The timeline's dragged range (`from=`, `to=`) stays too: the tool rail reads it as its frame. So do the
  // coverage window's own keys (`cov.*`): a link such as #doctor?unit=URO&ab=MEM arrives as cov.unit, cov.ab
  // and must survive the board's first write, or the drug a search asked for is lost.
  useEffect(() => {
    const keep = hashParams();
    const cov = Object.fromEntries([...keep].filter(([key]) => key.startsWith("cov.")));
    writeHashParams({ ...cov, ...boardToParams(state), project: keep.get("project"), from: keep.get("from"), to: keep.get("to") });
  }, [state]);
  // A link followed inside the app (or the back button) changes the hash without remounting.
  // Also when another component (the timeline's pills and lanes) writes `inc=` or `unit=` through url.ts.
  const [reveal, setReveal] = useState<{ id: WinId; key: string | null }>({ id: "signals", key: state.incident });
  // A doctor link (#doctor?…, arriving as `cov.*`) into a board that had none opens the coverage window: the
  // board is not remounted for it, so the window would otherwise stay wherever the saved layout left it.
  const hadCov = useRef([...hashParams().keys()].some((key) => key.startsWith("cov.")));
  useEffect(() => {
    const onHash = () => {
      setState((s) => {
        const next = boardFromUrl();
        return JSON.stringify(boardToParams(s)) === JSON.stringify(boardToParams(next)) ? s : next;
      });
      const hasCov = [...hashParams().keys()].some((key) => key.startsWith("cov."));
      if (hasCov && !hadCov.current) setReveal({ id: "coverage", key: `coverage-link-${Date.now()}` });
      hadCov.current = hasCov;
    };
    return subscribeHash(onHash);
  }, []);

  // "Show on map" (the signal card): reveal the map window and select the site's county in it. The county is
  // cleared when another incident is chosen, so the next click selects it again.
  const [mapCounty, setMapCounty] = useState<string | null>(null);
  const mapClicks = useRef(0);
  // "Open in Tools" (the card): the Tools window takes the signal's slice; cleared with the next selection.
  const [toolsPreset, setToolsPreset] = useState<Slice | null>(null);
  useEffect(() => {
    setReveal({ id: "signals", key: state.incident });
    setMapCounty(null);
    setToolsPreset(null);
  }, [state.incident]);
  // "Open in Tools" shows the rail and opens the Rate inspector on the signal's slice.
  const [railRequest, setRailRequest] = useState<{ key: number; tool: "rate" } | null>(null);
  const openTools = useCallback((slice: Slice) => {
    setToolsPreset(slice);
    setRailRequest((r) => ({ key: (r?.key ?? 0) + 1, tool: "rate" }));
  }, []);
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

  // The reading order for a selected signal: the Signals window (its card layer) first, the flow and the map
  // answer it, the rest step back.
  const primary: WinId | null = explicit ? "signals" : null;

  // The tool rail's frame follows the selected signal: the window its relations cover.
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
  const toolsWindow = toolsPreset
    ? {
        from: toolsPreset.from,
        to: toolsPreset.to,
        unit: toolsPreset.unit,
        phenotype: toolsPreset.phenotype,
        organism: toolsPreset.organism,
      }
    : (picked ?? signalWindow);
  const back = useCallback(() => onChange({ incident: null }), [onChange]);

  // The notebook page: one per hospital, and per project when one is open (kept in this browser; the project
  // shell, @aei/projects, stores no page). The board holds it, so "To notebook" reaches a closed window too.
  const notebook = useNotebookPage(pageSlot(currentSite(), project.id));
  const updateNotebook = notebook.update;
  const toNotebook = useCallback(
    (r: CellResult) => {
      updateNotebook((p) => appendResult(p, withSite(r, currentSite() ?? homeSite().id)));
      setReveal({ id: "notebook", key: `notebook-${Date.now()}` });
    },
    [updateNotebook],
  );
  const reproduceIn = useCallback((lang: NotebookLanguage) => {
    setNotebookLanguage(lang);
    setReveal({ id: "reproduce", key: `reproduce-${Date.now()}` });
  }, []);
  const notebookSignal: SliceSources["signal"] =
    signalWindow && selected ? { ...signalWindow, unit: selected.ward ?? "", phenotype: state.phenotype ?? "" } : null;

  const card = (layer: boolean) => (
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
      onOpenTools={openTools}
      explain={explain}
      onBack={layer ? back : undefined}
      empty={loading ? "loading" : "pick"}
    />
  );

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
      <SignalFeed
        {...panelProps}
        load={load}
        incidents={incidents}
        retry={retry}
        spansOf={spansOf}
        selected={explicit && selected ? selected.key : null}
        card={card(true)}
        layer={explicit}
        onBack={back}
      />
    ),
    reproduce: (
      <Reproduce locale={locale} project={project.response?.project} language={notebookLanguage} onLanguage={setNotebookLanguage} />
    ),
    map: (
      <GeoMap
        {...panelProps}
        focusCounty={mapCounty}
        signal={
          explicit && selected
            ? {
                phenotypes: selected.phenotypes,
                organism: "organism" in selected.lead ? (selected.lead.organism as string | undefined) : undefined,
                ward: selected.ward,
              }
            : null
        }
      />
    ),
    graph: <UnitGraph {...panelProps} />,
    grid: <UnitGrid {...panelProps} />,
    math: card(false),
    notebook: (
      <Notebook
        client={client}
        locale={locale}
        asOf={asOf}
        page={notebook.page}
        update={notebook.update}
        projectId={project.id}
        signal={notebookSignal}
        railCells={cells}
        onReproduce={reproduceIn}
      />
    ),
    answer: (
      <AnswerWindow
        locale={locale}
        asOf={asOf}
        incidents={shown}
        selected={selected}
        unit={state.unit}
        loading={loading}
        onEvidence={(incident) => {
          onChange({ incident: incident.key });
          setReveal({ id: "math", key: `answer-evidence-${Date.now()}` });
        }}
        onFlow={(incident) => {
          onChange({ incident: incident.key });
          setReveal({ id: "graph", key: `answer-flow-${Date.now()}` });
        }}
      />
    ),
    timeline: (
      <Timeline
        variant="window"
        client={client}
        locale={locale}
        clock={props.replay.clock}
        connection={props.replay.connection}
        lastArrivals={props.replay.lastArrivals}
        command={props.replay.command}
        liveAlerts={props.replay.liveAlerts}
        reducedMotion={props.reducedMotion}
      />
    ),
    assistant: (
      <Assistant client={client} locale={locale} incident={selected} spans={selected ? spansOf(selected) : null} waiting={loading} />
    ),
  };

  const chartMenu = (done: () => void) => (
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
  );

  // The URL's `panel` follows the last of the map and the unit grid that was opened or closed.
  // A coverage deep link opens its window even in a browser with no saved layout.
  const initiallyOpen = useRef<WinId[]>([
    ...(state.panel === "grid" ? ["grid" as const] : []),
    ...([...hashParams().keys()].some((key) => key.startsWith("cov.")) ? ["coverage" as const] : []),
  ]);
  return (
    <div className="section board">
      <InSlot name="actions">
        <ProjectActions
          client={client}
          locale={locale}
          clock={asOf}
          board={state}
          selection={project}
          onReproduce={() => setReveal({ id: "reproduce", key: `reproduce-${Date.now()}` })}
        />
      </InSlot>
      <Workspace
        clock={asOf}
        projectId={project.id}
        project={project.response?.project}
        client={client}
        locale={locale}
        content={content}
        initiallyOpen={initiallyOpen.current}
        reveal={reveal}
        onGone={gone}
        primary={primary}
        answers={ANSWERS}
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
        chartMenu={chartMenu}
        rail={
          <ToolRail
            {...panelProps}
            window={toolsWindow}
            onAddChart={addChart}
            onCells={setCells}
            onToNotebook={toNotebook}
            chartMenu={chartMenu}
            request={railRequest}
          />
        }
        revealRail={railRequest?.key}
        onOpened={(id) => (id === "grid" ? onChange({ panel: "grid" }) : id === "map" ? onChange({ panel: "geo" }) : undefined)}
        onClosed={(id) => (id === "grid" ? onChange({ panel: "geo" }) : undefined)}
      />
    </div>
  );
}
