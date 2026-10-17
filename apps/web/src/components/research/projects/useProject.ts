import type { AeiClient, ProjectResponse } from "@aei/contract";
import type { Project } from "@aei/projects";
import { useCallback, useEffect, useState } from "react";
import { HOSPITAL_PARAM, siteParam } from "../../../sites.ts";
import { hashParams, writeHashParams, writeSharedParam } from "../../../url.ts";

export function projectId(): string | null {
  return hashParams().get("project");
}

function remember(id: string | null) {
  const params = Object.fromEntries(hashParams());
  writeHashParams({ ...params, project: id });
  dispatchEvent(new HashChangeEvent("hashchange"));
}

export function openProject(project: Project) {
  // Replace the board query, not the shared timeline settings; hospital changes remount the board in App.
  const board = Object.fromEntries(new URLSearchParams(project.scope.board ?? ""));
  history.pushState(null, "", `#workspace${location.hash.includes("?") ? `?${hashParams()}` : ""}`);
  writeHashParams({ ...board, project: project.id });
  writeSharedParam(HOSPITAL_PARAM, siteParam(project.scope.site ?? null));
  dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useProject(client: AeiClient, clock: string | null) {
  const [id, setId] = useState(projectId);
  const [response, setResponse] = useState<ProjectResponse | null>(null);
  const [failed, setFailed] = useState(false);
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
    setResponse((previous) => (previous?.project.id === id ? previous : null));
    if (id)
      client
        .project(id)
        .then((next) => {
          if (!stale) setResponse(next);
        })
        .catch(() => {
          if (!stale) setFailed(true);
        });
    return () => {
      stale = true;
    };
  }, [client, id, clock, revision]);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  return { id, response: response?.project.id === id ? response : null, failed, refresh, remember };
}
