import type { IsoDate, IsolateRecord, Organism, Phenotype, SiteId, WardCode } from "@aei/domain";

export interface ProjectScope {
  site?: SiteId;
  from?: IsoDate;
  to?: IsoDate;
  units: WardCode[];
  organisms: Organism[];
  phenotypes: Phenotype[];
  kinds: string[];
  /** Research board hash query, e.g. unit=URO&ph=ESBL. */
  board?: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
  mode: "continuous" | "frozen";
  asOf?: IsoDate;
  scope: ProjectScope;
  /** Opaque workspace state (D-065), bounded to 20 kB of JSON. */
  layout?: Record<string, unknown>;
}

export interface Project extends ProjectInput {
  id: string;
  description: string;
  fingerprint?: { rows: number; sha256: string };
  createdAt: string;
  updatedAt: string;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

function date(value: unknown, field: string): IsoDate | undefined {
  const text = optionalString(value, field);
  if (text === undefined) return undefined;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be a valid ISO date (YYYY-MM-DD)`);
  }
  return text;
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error(`${field} must be an array of strings`);
  return [...value];
}

function layoutObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  const layout = object(value, "layout");
  if (Object.getPrototypeOf(layout) !== Object.prototype && Object.getPrototypeOf(layout) !== null) {
    throw new Error("layout must be a plain object");
  }
  let json: string;
  try {
    json = JSON.stringify(layout);
  } catch {
    throw new Error("layout must be JSON serializable");
  }
  if (new TextEncoder().encode(json).length > 20_000) throw new Error("layout exceeds 20 kB");
  const parsed = JSON.parse(json);
  return object(parsed, "layout");
}

/** Validate client input and keep only the fields clients may replace. */
export function parseProjectInput(value: unknown): ProjectInput {
  const input = object(value, "project");
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.length > 200) {
    throw new Error("name must be 1..200 characters, not blank");
  }
  if (input.mode !== "continuous" && input.mode !== "frozen") throw new Error("mode must be continuous or frozen");
  const asOf = date(input.asOf, "asOf");
  if (input.mode === "frozen" && !asOf) throw new Error("frozen projects require asOf");
  if (input.mode === "continuous" && asOf !== undefined) throw new Error("continuous projects must not have asOf");
  const scope = object(input.scope, "scope");
  const from = date(scope.from, "scope.from");
  const to = date(scope.to, "scope.to");
  if (from && to && from > to) throw new Error("scope.from must be on or before scope.to");
  return {
    name: input.name,
    description: optionalString(input.description, "description"),
    mode: input.mode,
    asOf,
    ...(input.layout !== undefined ? { layout: layoutObject(input.layout) } : {}),
    scope: {
      site: optionalString(scope.site, "scope.site"),
      from,
      to,
      units: strings(scope.units, "scope.units"),
      organisms: strings(scope.organisms, "scope.organisms") as Organism[],
      phenotypes: strings(scope.phenotypes, "scope.phenotypes") as Phenotype[],
      kinds: strings(scope.kinds, "scope.kinds"),
      board: optionalString(scope.board, "scope.board"),
    },
  };
}

export function isProjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{1,64}$/.test(value);
}

/** Site is left to the caller; kinds and board describe views, not isolate filters. */
export function matchesScope(record: IsolateRecord, scope: ProjectScope, asOf?: IsoDate): boolean {
  return (
    (!scope.from || record.sampleDate >= scope.from) &&
    (!scope.to || record.sampleDate <= scope.to) &&
    (!asOf || record.sampleDate <= asOf) &&
    (!scope.units.length || scope.units.includes(record.ward)) &&
    (!scope.organisms.length || scope.organisms.includes(record.organism)) &&
    (!scope.phenotypes.length || scope.phenotypes.some((p) => record.phenotypes.includes(p)))
  );
}
