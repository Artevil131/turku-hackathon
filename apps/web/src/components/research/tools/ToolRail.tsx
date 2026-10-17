import { t } from "@aei/i18n";
import { type ComponentType, type KeyboardEvent, type ReactNode, type SVGProps, useEffect, useRef, useState } from "react";
import type { ToolId } from "./model.ts";
import {
  BeliefIcon,
  ChartAddIcon,
  CompareIcon,
  DataIcon,
  DetectorIcon,
  RateIcon,
  ResetIcon,
  SelectIcon,
  SharesIcon,
} from "./ToolIcons.tsx";
import { type InspectorTool, ToolInspector, type ToolsProps } from "./ToolsWindow.tsx";
import "./rail.css";

// The tool rail of the research workspace: a slim column of tools, as in an image editor's toolbox. Select is the
// plain cursor; every other tool opens the inspector beside the rail (its few parameters, Run, its results). The
// same tool again, Escape or Select closes it; the rail stays. Keys: V, D, 1–5, C (never while typing in a field).

type RailTool = "data" | ToolId | "chart";

const TOOLS: readonly { id: RailTool | "select"; key: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "select", key: "V", Icon: SelectIcon },
  { id: "data", key: "D", Icon: DataIcon },
  { id: "rate", key: "1", Icon: RateIcon },
  { id: "compare", key: "2", Icon: CompareIcon },
  { id: "shares", key: "3", Icon: SharesIcon },
  { id: "beta", key: "4", Icon: BeliefIcon },
  { id: "detector", key: "5", Icon: DetectorIcon },
  { id: "chart", key: "C", Icon: ChartAddIcon },
];

const nameKey = (id: RailTool | "select" | "reset") => `toolsRail_${id}` as "toolsRail_rate";

export interface ToolRailProps extends ToolsProps {
  /** The "+ Chart" form; `done` closes the inspector. */
  chartMenu?: (done: () => void) => ReactNode;
  /** Each new `key` opens this tool's inspector (the card's "Open in Tools" hands over a slice and asks for the Rate tool). */
  request?: { key: number; tool: Exclude<RailTool, "chart"> } | null;
}

const typing = (el: Element | null) => !!el?.closest("input, textarea, select, [contenteditable='true']");

export function ToolRail(props: ToolRailProps) {
  const { locale, chartMenu, request } = props;
  const [active, setActive] = useState<RailTool | null>(null);
  const seenRequest = useRef(request?.key ?? 0);
  useEffect(() => {
    if (!request || request.key === seenRequest.current) return;
    seenRequest.current = request.key;
    setActive(request.tool);
    setBody(request.tool);
  }, [request]);
  // The inspector body stays mounted (and keeps its slice and results) while another tool or none is shown.
  const [body, setBody] = useState<InspectorTool>("rate");
  const [resetKey, setResetKey] = useState(0);
  const [status, setStatus] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const focusIn = useRef(false);

  const choose = (id: RailTool | "select", viaKey = false) => {
    const next = id === "select" || id === active ? null : id;
    setActive(next);
    if (next && next !== "chart") setBody(next);
    focusIn.current = next !== null && viaKey;
    if (next === null && active !== null && viaKey) root.current?.querySelector<HTMLElement>(`[data-tool="${active}"]`)?.focus();
  };
  const close = () => {
    const was = active;
    setActive(null);
    if (was) root.current?.querySelector<HTMLElement>(`[data-tool="${was}"]`)?.focus();
  };

  // A tool chosen by its key puts the keyboard in its first control, so Enter runs it.
  useEffect(() => {
    if (!active || !focusIn.current) return;
    focusIn.current = false;
    inspector.current?.querySelector<HTMLElement>(".ws-inspector-body:not([hidden]) :is(select, input, button[type=submit])")?.focus();
  });

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = root.current;
      if (!el || el.closest("[hidden]")) return;
      if (document.querySelector("[aria-modal='true'], dialog[open]")) return;
      const target = e.target instanceof Element ? e.target : null;
      if (e.key === "Escape") {
        // Escape closes the inspector before anything else on the page (focus mode waits for the next one).
        if (active === null || (typing(target) && !inspector.current?.contains(target))) return;
        if (target?.closest(".ws-pop")) return;
        e.preventDefault();
        close();
        return;
      }
      if (typing(target)) return;
      const tool = TOOLS.find((x) => x.key === e.key.toUpperCase());
      if (!tool) return;
      e.preventDefault();
      choose(tool.id, true);
    };
    // Capture, so Escape is taken before the workspace's own handler.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  // Arrow keys move along the rail (one tab stop for the whole toolbar).
  const onRailKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const to = step ? (i + step + buttons.length) % buttons.length : e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    buttons[to]?.focus();
  };

  const reset = () => {
    setResetKey((k) => k + 1);
    setStatus(t(locale, "toolsRailResetDone"));
  };
  const current = active ?? "select";
  const tip = (name: string, key?: string) => (
    <span className="ws-rail-tip" aria-hidden="true">
      {name}
      {key ? <kbd>{key}</kbd> : null}
    </span>
  );

  return (
    <div className="ws-tools" ref={root} data-open={active !== null}>
      <div className="ws-rail" role="toolbar" aria-orientation="vertical" aria-label={t(locale, "toolsRail")} onKeyDown={onRailKey}>
        {TOOLS.map(({ id, key, Icon }) => {
          const name = t(locale, nameKey(id));
          return (
            <button
              key={id}
              type="button"
              className="ws-rail-btn"
              data-tool={id}
              aria-pressed={current === id}
              aria-label={name}
              aria-keyshortcuts={key}
              aria-controls={id === "select" ? undefined : "ws-inspector"}
              tabIndex={current === id ? 0 : -1}
              onClick={() => choose(id)}
            >
              <Icon />
              {tip(name, key)}
            </button>
          );
        })}
        <span className="ws-rail-sep" aria-hidden="true" />
        <button
          type="button"
          className="ws-rail-btn"
          data-tool="reset"
          aria-label={t(locale, nameKey("reset"))}
          tabIndex={-1}
          onClick={reset}
        >
          <ResetIcon />
          {tip(t(locale, nameKey("reset")))}
        </button>
      </div>
      <aside
        ref={inspector}
        id="ws-inspector"
        className="ws-inspector"
        aria-label={active ? t(locale, nameKey(active)) : undefined}
        hidden={active === null}
      >
        <header className="ws-inspector-head">
          <span>{active ? t(locale, nameKey(active)) : ""}</span>
          <button type="button" className="ws-inspector-close" aria-label={t(locale, "toolsRailClose")} title="Esc" onClick={close}>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="ws-inspector-body" hidden={active === "chart"}>
          <ToolInspector {...props} tool={body} resetKey={resetKey} onEditSlice={() => choose("data")} />
        </div>
        {active === "chart" && chartMenu ? <div className="ws-inspector-body">{chartMenu(close)}</div> : null}
      </aside>
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
