import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IsolateRecord } from "@aei/domain";
import { isProjectId, type Project, parseProjectInput } from "./index.ts";

/** Server-made ids stay safe as file names, even for an empty/non-Latin slug. */
export function newProjectId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 47) || "project";
  return `${slug}-${randomBytes(8).toString("hex")}`;
}

export function fingerprintRows(records: IsolateRecord[]): { rows: number; sha256: string } {
  const rows = records.map((r) => ({
    id: r.isolateId,
    row: JSON.stringify([r.isolateId, r.sampleDate, r.ward, r.organism, Object.entries(r.results).sort(([a], [b]) => compare(a, b))]),
  }));
  rows.sort((a, b) => compare(a.id, b.id) || compare(a.row, b.row));
  return {
    rows: rows.length,
    sha256: createHash("sha256")
      .update(rows.map((r) => r.row).join("\n"))
      .digest("hex"),
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface ProjectStore {
  list(): Project[];
  get(id: string): Project | undefined;
  put(project: Project): void;
  delete(id: string): boolean;
}

function checkId(id: string) {
  if (!isProjectId(id)) throw new Error("invalid project id");
}

function storedProject(value: unknown, id: string): Project {
  const input = parseProjectInput(value);
  const project = value as Project;
  if (
    project.id !== id ||
    typeof project.createdAt !== "string" ||
    typeof project.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(project.createdAt)) ||
    !Number.isFinite(Date.parse(project.updatedAt))
  ) {
    throw new Error("invalid stored project");
  }
  if (
    project.fingerprint !== undefined &&
    (!project.fingerprint ||
      !Number.isInteger(project.fingerprint.rows) ||
      project.fingerprint.rows < 0 ||
      !/^[a-f0-9]{64}$/.test(project.fingerprint.sha256))
  )
    throw new Error("invalid stored fingerprint");
  return {
    ...input,
    id,
    description: input.description ?? "",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ...(project.fingerprint ? { fingerprint: project.fingerprint } : {}),
  };
}

/** One atomic JSON file per project, or a restart-volatile map when no directory is configured (D-057). */
export function createProjectStore(dir?: string): ProjectStore {
  const memory = new Map<string, Project>();
  const directory = dir ? join(dir, "projects") : undefined;
  const path = (id: string) => join(directory as string, `${id}.json`);
  const store: ProjectStore = {
    list() {
      const ids = directory
        ? existsSync(directory)
          ? readdirSync(directory, { withFileTypes: true })
              .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
              .map((entry) => entry.name.slice(0, -5))
              .filter(isProjectId)
          : []
        : [...memory.keys()];
      return ids
        .flatMap((id) => {
          // A file that cannot be read (permissions, a directory named *.json) is skipped like one that does not parse.
          try {
            const project = store.get(id);
            return project ? [project] : [];
          } catch {
            return [];
          }
        })
        .sort((a, b) => compare(b.updatedAt, a.updatedAt) || compare(a.id, b.id));
    },
    get(id) {
      checkId(id);
      if (!directory) {
        const project = memory.get(id);
        return project && structuredClone(project);
      }
      let text: string;
      try {
        text = readFileSync(path(id), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
      try {
        return storedProject(JSON.parse(text), id);
      } catch {
        return undefined;
      }
    },
    put(project) {
      checkId(project.id);
      const checked = storedProject(project, project.id);
      if (!directory) {
        memory.set(project.id, structuredClone(checked));
        return;
      }
      mkdirSync(directory, { recursive: true });
      const tmp = `${path(project.id)}.${randomBytes(8).toString("hex")}.tmp`;
      try {
        writeFileSync(tmp, `${JSON.stringify(checked, null, 2)}\n`, { flag: "wx" });
        renameSync(tmp, path(project.id));
      } finally {
        if (existsSync(tmp)) unlinkSync(tmp);
      }
    },
    delete(id) {
      checkId(id);
      if (!directory) return memory.delete(id);
      try {
        unlinkSync(path(id));
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    },
  };
  return store;
}
