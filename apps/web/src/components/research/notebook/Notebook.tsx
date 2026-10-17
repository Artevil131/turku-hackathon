import type { AeiClient } from "@aei/contract";
import { toPageZip } from "@aei/export";
import { formatDate, type Locale, phenotypeName, t } from "@aei/i18n";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { downloadFile } from "../../../downloadFile.ts";
import { siteWards } from "../../../sites.ts";
import { useHashParam } from "../../../url.ts";
import { chartTitle, specFromResult } from "../charts/model.ts";
import { type Cell, type CellResult, TOOL_IDS, type ToolId } from "../tools/model.ts";
import { eventName } from "../tools/ResultCell.tsx";
import { pickFrame, sliceSentence } from "../tools/ToolsWindow.tsx";
import { AnalysisCellBody } from "./cells/AnalysisCell.tsx";
import { ChartCellBody } from "./cells/ChartCell.tsx";
import { CodeCellBody } from "./cells/CodeCell.tsx";
import { NoteCellBody } from "./cells/NoteCell.tsx";
import { SliceCellBody, type SliceSources } from "./cells/SliceCell.tsx";
import {
  codeFor,
  defaultParams,
  insertAt,
  type Lang,
  moveCell,
  type NbCell,
  newId,
  newSlice,
  type Page,
  pageBlocks,
  paramsOf,
  patchCell,
  removeCell,
  resultAbove,
  type SliceCell,
  sameSlice,
  sliceAbove,
  sliceNumber,
} from "./model.ts";
import "./notebook.css";

// The notebook window: a vertical page of cells (slice, note, analysis, code, chart) with a thin "+" between
// them. Each analysis reads the nearest slice cell above it, so two slice cells are two frames on one page.
// Cells move by their grip (drag, or ↑ ↓ on it), collapse to one line and are removed by ×. The page is the
// board's (useNotebookPage), so it survives closing the window.

export interface NotebookProps {
  client: AeiClient;
  locale: Locale;
  asOf: string | null;
  page: Page;
  update: (fn: (p: Page) => Page) => void;
  /** The open project's id: the page is saved with it in this browser. */
  projectId: string | null;
  /** The selected signal's slice, for "Use selected signal". */
  signal: SliceSources["signal"];
  /** The rail's results, offered in the "+" menu. */
  railCells: readonly Cell[];
  /** Shows the Reproduce window in this language (the code cell's "Open in Reproduce"). */
  onReproduce: (lang: Lang) => void;
}

type AddKind = "slice" | "note" | "code" | ToolId | { rail: CellResult };

export function resultTitle(locale: Locale, r: CellResult): string {
  const event =
    r.kind === "compare" || r.kind === "shares" || r.kind === "beta"
      ? eventName(locale, r.event)
      : r.kind === "rate" && r.slice.phenotype
        ? phenotypeName(r.slice.phenotype)
        : "";
  return t(locale, (r.kind === "rate" && !event ? "toolsTitle_rateAll" : `toolsTitle_${r.kind}`) as "toolsTitle_rate", { event });
}

const toolName = (locale: Locale, tool: ToolId) => t(locale, `toolsRail_${tool}` as "toolsRail_rate");

/** The thin "+" between cells and its menu. Enter or a click opens it; Escape closes it and returns to the "+". */
function Adder({
  locale,
  open,
  onOpen,
  onClose,
  onPick,
  railCells,
  dropHere,
}: {
  locale: Locale;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (k: AddKind) => void;
  railCells: readonly Cell[];
  dropHere: boolean;
}) {
  const plus = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Near the bottom of the window the menu would be cut off: the window scrolls it into view first.
    menu.current?.scrollIntoView({ block: "nearest" });
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
  }, [open]);
  const close = () => {
    onClose();
    plus.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (step) {
      e.preventDefault();
      items[(i + step + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") onClose();
  };
  const item = (k: AddKind, label: string, key: string, hint?: string) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      tabIndex={-1}
      className="nb-menu-item"
      data-add={typeof k === "string" ? k : "rail"}
      onClick={() => onPick(k)}
    >
      <span>{label}</span>
      {hint ? <span className="nb-menu-hint">{hint}</span> : null}
    </button>
  );
  return (
    <div className="nb-adder" data-open={open || undefined} data-drop={dropHere || undefined}>
      <button
        ref={plus}
        type="button"
        className="nb-plus"
        aria-label={t(locale, "nbAdd")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={menu}
          className="nb-menu"
          role="menu"
          aria-label={t(locale, "nbAddMenu")}
          onKeyDown={onKey}
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) onClose();
          }}
        >
          <div className="nb-menu-group">
            {item("slice", t(locale, "nbKindSlice"), "slice")}
            {item("note", t(locale, "nbKindNote"), "note")}
            {item("code", t(locale, "nbKindCode"), "code")}
          </div>
          <div className="nb-menu-group">{TOOL_IDS.map((tool) => item(tool, toolName(locale, tool), tool))}</div>
          {railCells.length > 0 && (
            <div className="nb-menu-group" role="group" aria-label={t(locale, "nbFromRail")}>
              <span className="nb-menu-label" aria-hidden="true">
                {t(locale, "nbFromRail")}
              </span>
              {railCells
                .slice(0, 4)
                .map((c) =>
                  item(
                    { rail: c.result },
                    resultTitle(locale, c.result),
                    `rail-${c.id}`,
                    `${formatDate(locale, c.result.slice.from)}–${formatDate(locale, c.result.slice.to)}`,
                  ),
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .map((l) => l.replace(/^#{1,3}\s+|^\s*[-*]\s+/, "").trim())
      .find(Boolean) ?? ""
  );
}

export function Notebook({ client, locale, asOf, page, update, projectId, signal, railCells, onReproduce }: NotebookProps) {
  const [hashFrom] = useHashParam("from");
  const [hashTo] = useHashParam("to");
  const picked = pickFrame(hashFrom, hashTo, null);
  const timeline = picked.origin === "timeline" ? picked.frame : null;
  const sources: SliceSources = { timeline, signal };
  const wards = useMemo(() => siteWards().map((w) => w.code as string), []);
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<{ id: string; at: number | null } | null>(null);
  const [exporting, setExporting] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cells = page.cells;

  const focusCell = (id: string) => requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-cell="${id}"]`)?.focus());

  const add = (kind: AddKind, index: number) => {
    setMenuAt(null);
    const above = sliceAbove(cells, index);
    let at = index;
    let next = page;
    const put = (c: NbCell) => {
      next = insertAt(next, at++, c);
      return c;
    };
    let target: NbCell;
    if (kind === "slice") target = put({ id: newId(), kind: "slice", slice: newSlice(sources, above?.slice ?? null, asOf) });
    else if (kind === "note") target = put({ id: newId(), kind: "note", text: "" });
    else if (kind === "code") {
      const r = resultAbove(cells, index);
      target = put({ id: newId(), kind: "code", lang: "python", code: r ? codeFor(r, "python") : "", edited: false });
    } else if (typeof kind === "object") {
      const r = kind.rail;
      if (!above || !sameSlice(above.slice, r.slice)) put({ id: newId(), kind: "slice", slice: r.slice });
      target = put({ id: newId(), kind: "analysis", tool: r.kind, params: paramsOf(r), result: r });
    } else {
      // An analysis with nothing above to read gets its slice first.
      const s = above?.slice ?? (put({ id: newId(), kind: "slice", slice: newSlice(sources, null, asOf) }) as SliceCell).slice;
      target = put({ id: newId(), kind: "analysis", tool: kind, params: defaultParams(s), result: null });
    }
    update(() => next);
    setFresh(target.id);
    // A new note takes the keyboard in its editor; any other cell is focused as a whole.
    if (target.kind !== "note") focusCell(target.id);
  };

  const move = (id: string, to: number) => {
    update((p) => moveCell(p, id, to));
    const total = cells.length;
    setStatus(t(locale, "nbMoved", { n: Math.max(1, Math.min(total, to + 1)), total }));
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-grip="${id}"]`)?.focus());
  };

  const exportPage = async () => {
    setExporting(true);
    try {
      const date = asOf ?? new Date().toISOString().slice(0, 10);
      const blocks = pageBlocks(page, date, {
        title: t(locale, "nbPageTitle"),
        locale,
        sliceHeading: (n) => t(locale, "nbSlice", { n }),
        sliceSentence: (s) => sliceSentence(locale, s),
        toolTitle: (r, tool) => (r ? resultTitle(locale, r) : toolName(locale, tool)),
        notRun: t(locale, "nbNotRun"),
      });
      downloadFile(await toPageZip(blocks));
    } finally {
      setExporting(false);
    }
  };

  const titleOf = (c: NbCell, i: number): { title: string; summary: string } => {
    switch (c.kind) {
      case "slice":
        return { title: t(locale, "nbSlice", { n: sliceNumber(cells, c.id) }), summary: sliceSentence(locale, c.slice) };
      case "note":
        return { title: t(locale, "nbKindNote"), summary: firstLine(c.text) };
      case "code":
        return { title: `${t(locale, "nbKindCode")} · ${c.lang === "r" ? "R" : "Python"}`, summary: firstLine(c.code) };
      case "chart":
        return { title: t(locale, "nbChart"), summary: chartTitle(locale, c.spec, asOf) };
      case "analysis": {
        const s = sliceAbove(cells, i);
        const reads = s ? ` · ${t(locale, "nbReads", { n: sliceNumber(cells, s.id) })}` : "";
        return { title: `${toolName(locale, c.tool)}${reads}`, summary: c.result ? resultTitle(locale, c.result) : t(locale, "nbNotRun") };
      }
    }
  };

  const body = (c: NbCell, i: number): ReactNode => {
    const patch = (p: Partial<NbCell>) => update((pg) => patchCell(pg, c.id, p));
    switch (c.kind) {
      case "slice":
        return (
          <SliceCellBody id={c.id} locale={locale} slice={c.slice} wards={wards} sources={sources} onChange={(slice) => patch({ slice })} />
        );
      case "note":
        return <NoteCellBody id={c.id} locale={locale} text={c.text} autoEdit={fresh === c.id} onChange={(text) => patch({ text })} />;
      case "code": {
        const above = resultAbove(cells, i);
        return (
          <CodeCellBody
            cell={c}
            locale={locale}
            above={above}
            aboveName={above ? toolName(locale, above.kind) : ""}
            onChange={patch}
            onReproduce={onReproduce}
          />
        );
      }
      case "chart":
        return <ChartCellBody client={client} locale={locale} asOf={asOf} spec={c.spec} />;
      case "analysis": {
        const s = sliceAbove(cells, i);
        return (
          <AnalysisCellBody
            cell={c}
            locale={locale}
            client={client}
            asOf={asOf}
            slice={s?.slice ?? null}
            sliceN={s ? sliceNumber(cells, s.id) : 0}
            wards={wards}
            onChange={patch}
            onChart={(r) => {
              const spec = specFromResult(r);
              if (spec) update((pg) => insertAt(pg, pg.cells.findIndex((x) => x.id === c.id) + 1, { id: newId(), kind: "chart", spec }));
            }}
            onAddSlice={() => add("slice", i)}
          />
        );
      }
    }
  };

  const adder = (index: number) => (
    <Adder
      key={`add-${index}`}
      locale={locale}
      open={menuAt === index}
      onOpen={() => setMenuAt(index)}
      onClose={() => setMenuAt((m) => (m === index ? null : m))}
      onPick={(k) => add(k, index)}
      railCells={railCells}
      dropHere={drag?.at === index}
    />
  );

  const slices = cells.filter((c) => c.kind === "slice").length;
  const date = asOf ?? new Date().toISOString().slice(0, 10);
  return (
    <div className="nb" ref={root}>
      <div className="nb-bar">
        <div className="nb-bar-text">
          <h2 className="nb-h">{t(locale, "notebookWindow")}</h2>
          <p className="nb-muted">
            {t(locale, "nbCount", { n: cells.length, slices })} ·{" "}
            {projectId ? t(locale, "nbSavedProject", { id: projectId }) : t(locale, "nbSaved")}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          data-export-page
          disabled={cells.length === 0 || exporting}
          title={t(locale, "nbExportHint", { date: formatDate(locale, date, "long") })}
          onClick={() => void exportPage()}
        >
          {exporting ? t(locale, "nbExporting") : t(locale, "nbExport")}
        </button>
      </div>
      {cells.length === 0 && <p className="nb-empty">{t(locale, "nbEmpty")}</p>}
      {adder(0)}
      {cells.map((c, i) => {
        const { title, summary } = titleOf(c, i);
        const hid = `${c.id}-h`;
        return (
          <div key={c.id} className="nb-slot">
            <section
              className="nb-cell"
              data-cell={c.id}
              data-kind={c.kind}
              data-collapsed={c.collapsed || undefined}
              data-dragging={drag?.id === c.id || undefined}
              aria-labelledby={hid}
              tabIndex={-1}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const at = e.clientY < r.top + r.height / 2 ? i : i + 1;
                if (drag.at !== at) setDrag({ ...drag, at });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!drag || drag.at === null) return;
                const from = cells.findIndex((x) => x.id === drag.id);
                move(drag.id, drag.at > from ? drag.at - 1 : drag.at);
                setDrag(null);
              }}
            >
              <header className="nb-head">
                <button
                  type="button"
                  className="nb-grip"
                  data-grip={c.id}
                  draggable
                  aria-label={t(locale, "nbGrip")}
                  title={t(locale, "nbGrip")}
                  aria-describedby={hid}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", c.id);
                    const sec = e.currentTarget.closest("section");
                    if (sec) e.dataTransfer.setDragImage(sec, 16, 16);
                    setDrag({ id: c.id, at: null });
                  }}
                  onDragEnd={() => setDrag(null)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" && i > 0) {
                      e.preventDefault();
                      move(c.id, i - 1);
                    } else if (e.key === "ArrowDown" && i < cells.length - 1) {
                      e.preventDefault();
                      move(c.id, i + 1);
                    }
                  }}
                >
                  <svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true" focusable="false">
                    {[2, 7, 12].flatMap((y) => [
                      <circle key={`a${y}`} cx="2" cy={y} r="1.2" />,
                      <circle key={`b${y}`} cx="6" cy={y} r="1.2" />,
                    ])}
                  </svg>
                </button>
                <h3 id={hid} className="nb-title">
                  {title}
                </h3>
                {c.collapsed && summary ? <p className="nb-summary">{summary}</p> : null}
                <button
                  type="button"
                  className="nb-icon nb-collapse"
                  aria-expanded={!c.collapsed}
                  aria-controls={`${c.id}-body`}
                  aria-label={t(locale, c.collapsed ? "nbExpand" : "nbCollapse")}
                  title={t(locale, c.collapsed ? "nbExpand" : "nbCollapse")}
                  onClick={() => update((p) => patchCell(p, c.id, { collapsed: !c.collapsed }))}
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
                    <path
                      d={c.collapsed ? "M6 4l4 4-4 4" : "M4 6l4 4 4-4"}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="nb-icon"
                  aria-label={t(locale, "nbRemove")}
                  title={t(locale, "nbRemove")}
                  onClick={() => {
                    const nextId = cells[i + 1]?.id ?? cells[i - 1]?.id;
                    update((p) => removeCell(p, c.id));
                    if (nextId) focusCell(nextId);
                  }}
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
                    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </header>
              <div id={`${c.id}-body`} className="nb-body" hidden={c.collapsed}>
                {c.collapsed ? null : body(c, i)}
              </div>
            </section>
            {adder(i + 1)}
          </div>
        );
      })}
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
