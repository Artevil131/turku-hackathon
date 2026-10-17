import type { AeiClient, Project } from "@aei/contract";
import { figurePngFile, figureSvgFile, toCsvFiles, toDocx, toJson, toLatex, toMarkdown, toPython, toResearchPackage } from "@aei/export";
import { type Locale, t } from "@aei/i18n";
import { useEffect, useState } from "react";
import { downloadFile } from "../../../downloadFile.ts";
import { useShell } from "../../../shell/context.ts";
import { launchTemplate } from "../../../shell/launch.ts";
import { Menu, MenuItem, MenuSeparator } from "../../shell/Menu.tsx";
import { NewProjectDialog } from "../../start/NewProjectDialog.tsx";
import { ShareDialog } from "../../start/ShareDialog.tsx";
import type { BoardState } from "../board.ts";
import { workspaceBundle } from "./bundle.ts";
import { type ExportFormat, ExportFormatButtons } from "./ExportMenu.tsx";
import { DeleteProjectDialog, OpenProjectDialog, RenameProjectDialog, SaveProjectDialog } from "./ProjectDialogs.tsx";
import type { useProject } from "./useProject.ts";
import "./projects.css";

type Dialog = "new" | "open" | "save" | "frozen" | "rename" | "delete" | "share" | null;
/** Other parts of the view (an empty Reproduce window) ask for a project action by this event. */
export const PROJECT_ACTION = "aei:project-action";

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
export const ICONS = {
  project: "M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
  export: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14",
  share:
    "M8.5 10.5 15.5 6.5M8.5 13.5l7 4M18 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 21.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  reproduce: "M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1M17.5 3.5v3.6h-3.6M6.5 20.5v-3.6h3.6",
  windows: "M3.5 4.5h17v15h-17zM9.5 4.5v15M9.5 11h11",
};
export const SidebarIcon = ({ name }: { name: keyof typeof ICONS }) => <Icon d={ICONS[name]} />;

/**
 * The open project's actions, shown in the sidebar under its name: the Project menu (new, open, save a
 * frozen version, duplicate, rename, delete, close), Export, Share and Reproduce.
 */
export function ProjectActions({
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
  const shell = useShell();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<"exportError" | "exportNoFigures" | "exportDone" | "pmError" | null>(null);
  const project = selection.response?.project;
  const loading = !!selection.id && !project && !selection.failed;
  useEffect(() => {
    const ask = (event: Event) => {
      const action = (event as CustomEvent<Dialog>).detail;
      if (action) setDialog(action);
    };
    addEventListener(PROJECT_ACTION, ask);
    return () => removeEventListener(PROJECT_ACTION, ask);
  }, []);
  async function run(format: ExportFormat) {
    const workspace = document.querySelector<HTMLElement>(".ws");
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
  const act = async (work: () => Promise<Project>) => {
    setWorking(true);
    setStatus(null);
    try {
      shell.openProject(await work());
    } catch {
      setStatus("pmError");
    } finally {
      setWorking(false);
    }
  };
  const saved = (next: Project) => {
    // A project-less view saved as a project becomes that project; a frozen version opens beside the original.
    if (!project) shell.closeActive();
    shell.openProject(next);
  };
  const reproducible = !!project && !!onReproduce;
  return (
    <>
      <Menu id="pm-project" label={t(locale, "pmMenu")} icon={<SidebarIcon name="project" />} disabled={loading || working}>
        <MenuItem data-pm="new" onSelect={() => void act(() => launchTemplate(client, locale, "blank"))}>
          {t(locale, "pmNew")}
        </MenuItem>
        <MenuItem data-pm="new-custom" onSelect={() => setDialog("new")}>
          {t(locale, "pmNewCustom")}
        </MenuItem>
        <MenuItem data-pm="open" onSelect={() => setDialog("open")}>
          {t(locale, "pmOpen")}
        </MenuItem>
        <MenuSeparator />
        {project ? (
          <>
            <MenuItem data-pm="frozen" disabled={!clock} onSelect={() => setDialog("frozen")}>
              {t(locale, "pmSaveFrozen")}
            </MenuItem>
            <MenuItem
              data-pm="duplicate"
              onSelect={() =>
                void act(async () => {
                  const fresh = (await client.project(project.id)).project;
                  return (await client.createProject({ ...fresh, name: t(locale, "startCopyName", { name: fresh.name }).slice(0, 200) }))
                    .project;
                })
              }
            >
              {t(locale, "pmDuplicate")}
            </MenuItem>
            <MenuItem data-pm="rename" onSelect={() => setDialog("rename")}>
              {t(locale, "pmRename")}
            </MenuItem>
            <MenuItem data-pm="delete" onSelect={() => setDialog("delete")}>
              {t(locale, "pmDelete")}
            </MenuItem>
          </>
        ) : (
          <MenuItem data-pm="save" disabled={!clock || selection.failed} onSelect={() => setDialog("save")}>
            {t(locale, "pmSaveAs")}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem data-pm="close" onSelect={() => shell.closeActive()}>
          {t(locale, "pmClose")}
        </MenuItem>
      </Menu>
      <Menu
        id="pm-export"
        label={t(locale, busy ? "exportBuilding" : "exportMenu")}
        icon={<SidebarIcon name="export" />}
        disabled={!clock || selection.failed || loading}
        wide
      >
        <ExportFormatButtons locale={locale} busy={busy} onSelect={(format) => void run(format)} />
        {busy ? <p role="status">{t(locale, "exportBuilding")}</p> : null}
        {status && status !== "pmError" ? (
          <p className={status === "exportError" ? "project-error" : "sb-pop-status"} role={status === "exportError" ? "alert" : "status"}>
            {t(locale, status)}
          </p>
        ) : null}
      </Menu>
      <button
        type="button"
        className="sb-item"
        data-share
        disabled={!project}
        title={project ? t(locale, "shareAction") : t(locale, "reproduceEmpty")}
        onClick={() => setDialog("share")}
      >
        <span className="sb-icon">
          <SidebarIcon name="share" />
        </span>
        <span className="sb-label">{t(locale, "shareAction")}</span>
      </button>
      <button
        type="button"
        className="sb-item"
        data-open-reproduce
        disabled={!reproducible}
        title={reproducible ? t(locale, "reproduceAction") : t(locale, "reproduceEmpty")}
        onClick={onReproduce}
      >
        <span className="sb-icon">
          <SidebarIcon name="reproduce" />
        </span>
        <span className="sb-label">{t(locale, "reproduceAction")}</span>
      </button>
      {status === "pmError" || (status && !busy) ? (
        <p className="sb-status" role={status === "exportError" || status === "pmError" ? "alert" : "status"}>
          {t(locale, status)}
        </p>
      ) : null}
      {dialog === "new" ? (
        <NewProjectDialog client={client} locale={locale} clock={clock} initial="outbreak" onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "open" ? (
        <OpenProjectDialog
          client={client}
          locale={locale}
          currentId={selection.id}
          onOpen={shell.openProject}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "save" || (dialog === "frozen" && project) ? (
        <SaveProjectDialog
          client={client}
          locale={locale}
          clock={clock}
          board={board}
          current={dialog === "frozen" ? project : undefined}
          onSaved={saved}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "rename" && project ? (
        <RenameProjectDialog
          client={client}
          locale={locale}
          project={project}
          onSaved={() => selection.refresh()}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "delete" && project ? (
        <DeleteProjectDialog
          client={client}
          locale={locale}
          project={project}
          onDeleted={(gone) => shell.closeProject(gone.id)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "share" && project ? <ShareDialog project={project} locale={locale} onClose={() => setDialog(null)} /> : null}
    </>
  );
}
