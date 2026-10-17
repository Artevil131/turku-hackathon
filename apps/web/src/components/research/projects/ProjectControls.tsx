import type { AeiClient } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";
import { lazy, Suspense, useRef, useState } from "react";
import { downloadFile } from "../../../downloadFile.ts";
import type { BoardState } from "../board.ts";
import { workspaceBundle } from "./bundle.ts";
import type { ExportFormat } from "./ExportMenu.tsx";
import type { useProject } from "./useProject.ts";
import "./projects.css";

// The projects window and the export menu open on demand, so their code (the export gear: docx, jszip) stays off the research page.
const ProjectsPanel = lazy(() => import("./ProjectsPanel.tsx").then((m) => ({ default: m.ProjectsPanel })));
const ExportMenu = lazy(() => import("./ExportMenu.tsx").then((m) => ({ default: m.ExportMenu })));
const ExportFormatButtons = lazy(() => import("./ExportMenu.tsx").then((m) => ({ default: m.ExportFormatButtons })));

export function ProjectControls({
  client,
  locale,
  clock,
  board,
  selection,
  onReproduce,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  board: BoardState;
  selection: ReturnType<typeof useProject>;
  onReproduce?: () => void;
}) {
  const [panel, setPanel] = useState<"projects" | "export" | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"exportError" | "exportNoFigures" | "exportDone" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const exportTrigger = useRef<HTMLButtonElement>(null);
  const project = selection.response?.project;
  async function run(format: ExportFormat) {
    const workspace = root.current?.closest<HTMLElement>(".ws");
    if (!clock || !workspace || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const { figurePngFile, figureSvgFile, toCsvFiles, toDocx, toJson, toLatex, toMarkdown, toPython, toResearchPackage } = await import(
        "@aei/export"
      );
      const bundle = await workspaceBundle({
        client,
        board,
        clock,
        project,
        root: workspace,
        png: format === "zip" || format === "png" || format === "docx",
        locale,
      });
      if ((format === "svg" || format === "png") && !bundle.figures.length) {
        setStatus("exportNoFigures");
        return;
      }
      const files =
        format === "csv"
          ? toCsvFiles(bundle)
          : format === "svg"
            ? bundle.figures.map(figureSvgFile)
            : format === "png"
              ? bundle.figures.map(figurePngFile)
              : [
                  format === "zip"
                    ? await toResearchPackage(bundle)
                    : format === "docx"
                      ? await toDocx(bundle)
                      : format === "json"
                        ? toJson(bundle)
                        : format === "md"
                          ? toMarkdown(bundle)
                          : format === "tex"
                            ? toLatex(bundle)
                            : toPython(bundle),
                ];
      for (const file of files) downloadFile(file);
      setStatus("exportDone");
    } catch {
      setStatus("exportError");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {project?.mode === "frozen" ? (
        <span className="project-frozen" role="status">
          {t(locale, "projectFrozenBanner", { date: project.asOf ?? "" })}
          {selection.response?.drift ? <strong> · {t(locale, "projectDrift")}</strong> : null}
        </span>
      ) : null}
      <div className="project-controls" ref={root}>
        <button
          type="button"
          className="ws-tray-button"
          data-project-dialog
          aria-haspopup="dialog"
          aria-expanded={panel === "projects"}
          disabled={!!selection.id && !project && !selection.failed}
          onClick={() => setPanel("projects")}
        >
          {t(locale, "projectButton")}
        </button>
        <button
          type="button"
          className="ws-tray-button"
          aria-haspopup="menu"
          ref={exportTrigger}
          aria-expanded={panel === "export"}
          disabled={!clock || busy || selection.failed || (!!selection.id && !project)}
          onClick={() => {
            setStatus(null);
            setPanel("export");
          }}
        >
          {t(locale, busy ? "exportBuilding" : "exportButton")}
        </button>
        {project && onReproduce ? (
          <button type="button" className="ws-tray-button" data-open-reproduce onClick={onReproduce}>
            {t(locale, "boardReproduce")}
          </button>
        ) : null}
        {panel !== "export" && (busy || status) ? (
          <span className="project-export-status" role={status === "exportError" ? "alert" : "status"}>
            {t(locale, busy ? "exportBuilding" : (status ?? "exportDone"))}
          </span>
        ) : null}
        {panel === "projects" ? (
          <Suspense fallback={null}>
            <ProjectsPanel
              client={client}
              locale={locale}
              clock={clock}
              board={board}
              selection={selection}
              onClose={() => setPanel(null)}
            />
          </Suspense>
        ) : null}
        {panel === "export" ? (
          <Suspense fallback={null}>
            <ExportMenu title={t(locale, "exportTitle")} anchor={exportTrigger.current} onClose={() => setPanel(null)}>
              <ExportFormatButtons locale={locale} busy={busy} onSelect={(format) => void run(format)} />
              {busy ? <p role="status">{t(locale, "exportBuilding")}</p> : null}
              {status ? (
                <p className={status === "exportError" ? "project-error" : undefined} role={status === "exportError" ? "alert" : "status"}>
                  {t(locale, status)}
                </p>
              ) : null}
            </ExportMenu>
          </Suspense>
        ) : null}
      </div>
    </>
  );
}
