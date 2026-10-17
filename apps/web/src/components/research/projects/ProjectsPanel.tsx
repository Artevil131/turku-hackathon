import type { AeiClient } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";
import type { Project, ProjectInput } from "@aei/projects";
import { useEffect, useState } from "react";
import type { BoardState } from "../board.ts";
import { workspaceScope } from "./bundle.ts";
import { ProjectDialog } from "./ProjectDialog.tsx";
import { openProject, type useProject } from "./useProject.ts";

type Selection = ReturnType<typeof useProject>;

export function ProjectsPanel({
  client,
  locale,
  clock,
  board,
  selection,
  onClose,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  board: BoardState;
  selection: Selection;
  onClose: () => void;
}) {
  const current = selection.response?.project;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState(current?.name ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [mode, setMode] = useState<ProjectInput["mode"]>(current?.mode ?? "continuous");
  const [asOf, setAsOf] = useState(current?.asOf ?? clock ?? "");
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly refreshes the server list
  useEffect(() => {
    let stale = false;
    setLoading(true);
    client
      .projects()
      .then((result) => {
        if (!stale) {
          setProjects(result.projects);
          setError(false);
        }
      })
      .catch(() => {
        if (!stale) setError(true);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [client, revision]);
  async function save(update: boolean) {
    if (!clock || !name.trim() || (mode === "frozen" && (!asOf || asOf > clock))) return;
    setBusy(true);
    setError(false);
    try {
      const scope = workspaceScope(board, clock);
      const input: ProjectInput = {
        name: name.trim(),
        description,
        mode,
        asOf: mode === "frozen" ? asOf : undefined,
        scope: { ...scope, to: mode === "frozen" ? asOf : undefined },
      };
      const result = update && current ? await client.updateProject(current.id, input) : await client.createProject(input);
      selection.remember(result.project.id);
      selection.refresh();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(project: Project) {
    if (!confirm(t(locale, "projectDeleteConfirm", { name: project.name }))) return;
    setBusy(true);
    setError(false);
    try {
      await client.deleteProject(project.id);
      if (selection.id === project.id) selection.remember(null);
      setRevision((n) => n + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProjectDialog title={t(locale, "projectTitle")} closeLabel={t(locale, "projectClose")} onClose={onClose}>
      {error || selection.failed ? (
        <p className="project-error" role="alert">
          {t(locale, "projectError")}
        </p>
      ) : null}
      <div className="project-list" aria-busy={loading}>
        {loading ? (
          <p role="status">{t(locale, "projectLoading")}</p>
        ) : projects.length ? (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <span className="project-mode">
                    {t(locale, project.mode === "frozen" ? "projectFrozen" : "projectContinuous")}
                    {project.asOf ? ` · ${project.asOf}` : ""}
                  </span>
                  <small>{t(locale, "projectUpdated", { date: new Date(project.updatedAt).toLocaleDateString(locale) })}</small>
                </div>
                <div className="project-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      openProject(project);
                      onClose();
                    }}
                  >
                    {t(locale, "projectOpen")}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void remove(project)}>
                    {t(locale, "projectDelete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t(locale, "projectEmpty")}</p>
        )}
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => {
            setRevision((n) => n + 1);
            selection.refresh();
          }}
        >
          {t(locale, "projectRefresh")}
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        {current ? <p>{t(locale, "projectCurrent", { name: current.name })}</p> : null}
        <label>
          {t(locale, "projectName")}
          <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {t(locale, "projectDescription")}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>
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
        <div className="project-actions">
          <button type="submit" disabled={busy || !clock || !name.trim() || (mode === "frozen" && (!asOf || asOf > clock))}>
            {t(locale, busy ? "projectBusy" : "projectSave")}
          </button>
          {current ? (
            <button
              type="button"
              disabled={busy || !clock || !name.trim() || (mode === "frozen" && (!asOf || asOf > clock))}
              onClick={(event) => {
                if (event.currentTarget.form?.reportValidity()) void save(true);
              }}
            >
              {t(locale, "projectUpdate")}
            </button>
          ) : null}
        </div>
      </form>
    </ProjectDialog>
  );
}
