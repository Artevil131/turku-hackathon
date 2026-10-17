import type { AeiClient } from "@aei/contract";
import { figurePngFile, figureSvgFile, toCsvFiles, toDocx, toJson, toLatex, toMarkdown, toPython, toResearchPackage } from "@aei/export";
import { type Locale, t } from "@aei/i18n";
import { useRef, useState } from "react";
import { downloadFile } from "../../../downloadFile.ts";
import type { BoardState } from "../board.ts";
import { workspaceBundle } from "./bundle.ts";
import { type ExportFormat, ExportFormatButtons, ExportMenu } from "./ExportMenu.tsx";
import { ProjectsPanel } from "./ProjectsPanel.tsx";
import type { useProject } from "./useProject.ts";
import "./projects.css";

export function ProjectControls({
  client,
  locale,
  clock,
  board,
  selection,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  board: BoardState;
  selection: ReturnType<typeof useProject>;
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
        {panel !== "export" && (busy || status) ? (
          <span className="project-export-status" role={status === "exportError" ? "alert" : "status"}>
            {t(locale, busy ? "exportBuilding" : (status ?? "exportDone"))}
          </span>
        ) : null}
        {panel === "projects" ? (
          <ProjectsPanel client={client} locale={locale} clock={clock} board={board} selection={selection} onClose={() => setPanel(null)} />
        ) : null}
        {panel === "export" ? (
          <ExportMenu title={t(locale, "exportTitle")} anchor={exportTrigger.current} onClose={() => setPanel(null)}>
            <ExportFormatButtons locale={locale} busy={busy} onSelect={(format) => void run(format)} />
            {busy ? <p role="status">{t(locale, "exportBuilding")}</p> : null}
            {status ? (
              <p className={status === "exportError" ? "project-error" : undefined} role={status === "exportError" ? "alert" : "status"}>
                {t(locale, status)}
              </p>
            ) : null}
          </ExportMenu>
        ) : null}
      </div>
    </>
  );
}
