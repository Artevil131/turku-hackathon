import type { AeiClient, Project } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import type { ProjectInput } from "@aei/projects";
import { useEffect, useState } from "react";
import type { BoardState } from "../board.ts";
import { STORAGE_KEY } from "../workspace/layout.ts";
import { workspaceScope } from "./bundle.ts";
import { ProjectDialog } from "./ProjectDialog.tsx";

/** The project-less view's layout, which a saved project starts from. */
function browserLayout(): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Saves what is on screen as a project: from a project-less view (continuous or frozen), or a frozen
 * version of the open project. Either way the new project opens in its own tab.
 */
export function SaveProjectDialog({
  client,
  locale,
  clock,
  board,
  current,
  onSaved,
  onClose,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  board: BoardState;
  /** Set for "Save as frozen version" of an open project. */
  current?: Project;
  onSaved: (project: Project) => void;
  onClose: () => void;
}) {
  const frozenOnly = !!current;
  const [name, setName] = useState(current ? t(locale, "pmFrozenName", { name: current.name, date: clock ?? "" }).slice(0, 200) : "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [mode, setMode] = useState<ProjectInput["mode"]>(frozenOnly ? "frozen" : "continuous");
  const [asOf, setAsOf] = useState(clock ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const invalid = !clock || !name.trim() || (mode === "frozen" && (!asOf || asOf > clock));
  async function save() {
    if (invalid || busy || !clock) return;
    setBusy(true);
    setError(false);
    try {
      const scope = workspaceScope(board, clock);
      const layout = current ? (await client.project(current.id)).project.layout : browserLayout();
      const { project } = await client.createProject({
        name: name.trim(),
        description,
        mode,
        asOf: mode === "frozen" ? asOf : undefined,
        scope: { ...scope, to: mode === "frozen" ? asOf : undefined },
        layout,
      });
      onSaved(project);
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProjectDialog
      title={t(locale, frozenOnly ? "pmSaveFrozenTitle" : "pmSaveTitle")}
      closeLabel={t(locale, "projectClose")}
      onClose={onClose}
    >
      <form
        className="project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {frozenOnly ? <p className="project-note">{t(locale, "pmSaveFrozenNote")}</p> : null}
        <label>
          {t(locale, "projectName")}
          {/* biome-ignore lint/a11y/noAutofocus: the dialog exists to name the project */}
          <input required autoFocus maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {t(locale, "projectDescription")}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>
        {frozenOnly ? null : (
          <fieldset>
            <legend>{t(locale, "projectMode")}</legend>
            {(["continuous", "frozen"] as const).map((value) => (
              <label className="project-radio" key={value}>
                <input
                  type="radio"
                  name="project-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                    if (value === "frozen" && !asOf && clock) setAsOf(clock);
                  }}
                />
                {t(locale, value === "frozen" ? "projectFrozen" : "projectContinuous")}
              </label>
            ))}
          </fieldset>
        )}
        {mode === "frozen" ? (
          <label>
            {t(locale, "projectAsOf")}
            <input
              type="date"
              required
              min={clock ? workspaceScope(board, clock).from : undefined}
              max={clock ?? undefined}
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              aria-describedby="project-date-hint"
            />
            <small id="project-date-hint">{t(locale, "projectDateHint", { date: clock ?? "—" })}</small>
          </label>
        ) : null}
        {error ? (
          <p className="project-error" role="alert">
            {t(locale, "pmError")}
          </p>
        ) : null}
        <div className="project-actions">
          <button type="submit" className="project-primary" disabled={busy || invalid}>
            {t(locale, busy ? "projectBusy" : "projectSave")}
          </button>
          <button type="button" onClick={onClose}>
            {t(locale, "startCancel")}
          </button>
        </div>
      </form>
    </ProjectDialog>
  );
}

export function RenameProjectDialog({
  client,
  locale,
  project,
  onSaved,
  onClose,
}: {
  client: AeiClient;
  locale: Locale;
  project: Project;
  onSaved: (project: Project) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <ProjectDialog title={t(locale, "pmRenameTitle", { name: project.name })} closeLabel={t(locale, "projectClose")} onClose={onClose}>
      <form
        className="project-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !name.trim()) return;
          setBusy(true);
          setError(false);
          try {
            // Read just before replacing, so the layout saved meanwhile is kept.
            const fresh = (await client.project(project.id)).project;
            const result = await client.updateProject(project.id, { ...fresh, name: name.trim(), description });
            onSaved(result.project);
            onClose();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t(locale, "projectName")}
          {/* biome-ignore lint/a11y/noAutofocus: the dialog exists to rename */}
          <input required autoFocus maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {t(locale, "projectDescription")}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>
        {error ? (
          <p className="project-error" role="alert">
            {t(locale, "pmError")}
          </p>
        ) : null}
        <div className="project-actions">
          <button type="submit" className="project-primary" disabled={busy || !name.trim()}>
            {t(locale, busy ? "pmBusy" : "pmSave")}
          </button>
          <button type="button" onClick={onClose}>
            {t(locale, "startCancel")}
          </button>
        </div>
      </form>
    </ProjectDialog>
  );
}

export function DeleteProjectDialog({
  client,
  locale,
  project,
  onDeleted,
  onClose,
}: {
  client: AeiClient;
  locale: Locale;
  project: Project;
  onDeleted: (project: Project) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <ProjectDialog title={t(locale, "startDeleteTitle", { name: project.name })} closeLabel={t(locale, "startCancel")} onClose={onClose}>
      <p>{t(locale, "startDeleteNote")}</p>
      {error ? (
        <p className="project-error" role="alert">
          {t(locale, "startError")}
        </p>
      ) : null}
      <div className="project-actions">
        <button
          type="button"
          className="project-danger"
          data-confirm-delete
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              await client.deleteProject(project.id);
              onDeleted(project);
              onClose();
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(locale, busy ? "pmBusy" : "startDelete")}
        </button>
        <button type="button" onClick={onClose}>
          {t(locale, "startCancel")}
        </button>
      </div>
    </ProjectDialog>
  );
}

/** Every saved project, newest first, to open in its own tab. */
export function OpenProjectDialog({
  client,
  locale,
  currentId,
  onOpen,
  onClose,
}: {
  client: AeiClient;
  locale: Locale;
  currentId: string | null;
  onOpen: (project: Project) => void;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision retries the list
  useEffect(() => {
    let stale = false;
    setError(false);
    client
      .projects()
      .then((result) => {
        if (!stale) setProjects([...result.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      })
      .catch(() => {
        if (!stale) setError(true);
      });
    return () => {
      stale = true;
    };
  }, [client, revision]);
  return (
    <ProjectDialog title={t(locale, "pmOpenTitle")} closeLabel={t(locale, "projectClose")} onClose={onClose}>
      <div className="project-list" aria-busy={projects === null && !error}>
        {error ? (
          <p className="project-error" role="alert">
            {t(locale, "projectError")}{" "}
            <button type="button" onClick={() => setRevision((n) => n + 1)}>
              {t(locale, "startRetry")}
            </button>
          </p>
        ) : projects === null ? (
          <p role="status">{t(locale, "projectLoading")}</p>
        ) : projects.length ? (
          <ul>
            {projects.map((project) => (
              <li key={project.id} data-project-row={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <span className="project-mode">
                    {t(locale, project.mode === "frozen" ? "projectFrozen" : "projectContinuous")}
                    {project.asOf ? ` · ${formatDate(locale, project.asOf)}` : ""}
                  </span>
                  <small>{t(locale, "projectUpdated", { date: new Date(project.updatedAt).toLocaleDateString(locale) })}</small>
                </div>
                <button
                  type="button"
                  className={project.id === currentId ? undefined : "project-primary"}
                  aria-current={project.id === currentId || undefined}
                  onClick={() => {
                    onOpen(project);
                    onClose();
                  }}
                >
                  {t(locale, "projectOpen")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t(locale, "projectEmpty")}</p>
        )}
      </div>
    </ProjectDialog>
  );
}
