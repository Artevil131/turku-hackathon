import { type AeiClient, ApiError, type ProjectResponse } from "@aei/contract";
import type { Project } from "@aei/projects";
import { useCallback, useEffect, useState } from "react";
import { HOSPITAL_PARAM, siteParam } from "../../../sites.ts";
import { hashParams, writeHashParams } from "../../../url.ts";

export function projectId(): string | null {
  return hashParams().get("project");
}

function remember(id: string | null) {
  const params = Object.fromEntries(hashParams());
  writeHashParams({ ...params, project: id });
  dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * The hash a project opens at: its saved board view, its id, its hospital and the timeline layers in use
 * (`tl`), nothing else of the current page (a quick start or another project's filters do not carry over).
 */
export function projectHash(project: Project, current: URLSearchParams = hashParams()): string {
  const params = new URLSearchParams(project.scope.board ?? "");
  params.delete("project");
  params.set("project", project.id);
  const site = siteParam(project.scope.site ?? null);
  if (site) params.set(HOSPITAL_PARAM, site);
  const tl = current.get("tl");
  if (tl) params.set("tl", tl);
  return `#project?${params}`;
}

/** Goes to a project's view; App opens (or switches to) its tab on the hash change. */
export function openProject(project: Project, hash = projectHash(project)) {
  history.pushState(null, "", hash);
  dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useProject(client: AeiClient, clock: string | null) {
  const [id, setId] = useState(projectId);
  const [response, setResponse] = useState<ProjectResponse | null>(null);
  const [failed, setFailed] = useState(false);
  /** The server says the project no longer exists (deleted elsewhere). */
  const [missing, setMissing] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setId(projectId());
    addEventListener("hashchange", changed);
    addEventListener("popstate", changed);
    return () => {
      removeEventListener("hashchange", changed);
      removeEventListener("popstate", changed);
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh drift on clock movement and explicit retry
  useEffect(() => {
    let stale = false;
    setFailed(false);
    setMissing(false);
    setResponse((previous) => (previous?.project.id === id ? previous : null));
    if (id)
      client
        .project(id)
        .then((next) => {
          if (!stale) setResponse(next);
        })
        .catch((error) => {
          if (stale) return;
          setFailed(true);
          if (error instanceof ApiError && error.status === 404) setMissing(true);
        });
    return () => {
      stale = true;
    };
  }, [client, id, clock, revision]);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  return { id, response: response?.project.id === id ? response : null, failed, missing, refresh, remember };
}
