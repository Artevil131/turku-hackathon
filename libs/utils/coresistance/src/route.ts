import {
  AGE_GROUPS,
  ANTIBIOTICS,
  type AntibioticCode,
  type IsoDate,
  type IsolateRecord,
  isAgeGroup,
  type Specimen,
  type WardCode,
} from "@aei/domain";
import { type FailsTogetherQuery, type FailsTogetherResult, type Family, failsTogether, families } from "./index.ts";

// The contract of a future route, GET /api/fails-together (D-048), kept in
// the gear until it is wired into apps/api and @aei/contract. Pure: the
// server passes its released records and clock date.

/** What a client may ask; the server sets the as-of date from its clock. */
export type FailsTogetherRouteQuery = Omit<FailsTogetherQuery, "asOf" | "minResisted" | "top">;

export interface FailsTogetherResponse {
  asOf: IsoDate;
  failsTogether: FailsTogetherResult;
  /** The code list's classes, so the UI can show related drugs together. */
  families: Family<AntibioticCode>[];
}

export type Parsed = { ok: true; query: FailsTogetherRouteQuery } | { ok: false; error: string };

/** Validates the query string the way /api/coverage does; 400 with `error` when not ok. */
export function parseQuery(params: URLSearchParams, wards: readonly string[], specimens: readonly string[]): Parsed {
  const ward = params.get("ward");
  const specimen = params.get("specimen");
  const sex = params.get("sex");
  const ageGroup = params.get("ageGroup");
  const onset = params.get("onset");
  const windowDays = params.get("windowDays");
  if (ward === null || !wards.includes(ward)) return { ok: false, error: "ward is required and must be a ward code" };
  if (specimen === null || !specimens.includes(specimen)) return { ok: false, error: "specimen is required" };
  if (sex !== null && sex !== "F" && sex !== "M") return { ok: false, error: "sex must be F or M" };
  if (ageGroup !== null && !isAgeGroup(ageGroup))
    return { ok: false, error: `ageGroup must be one of ${Object.keys(AGE_GROUPS).join(", ")}` };
  if (onset !== null && onset !== "hospital") return { ok: false, error: "onset must be hospital" };
  const days = windowDays === null ? undefined : Number(windowDays);
  if (days !== undefined && (!Number.isInteger(days) || days < 1)) return { ok: false, error: "windowDays must be a positive integer" };
  return {
    ok: true,
    query: {
      ward: ward as WardCode,
      specimen: specimen as Specimen,
      ...(sex ? { sex } : {}),
      ...(ageGroup && isAgeGroup(ageGroup) ? { ageGroup } : {}),
      ...(onset === "hospital" ? { onset } : {}),
      ...(days ? { windowDays: days } : {}),
    },
  };
}

/** A cache key for one answer: the query and the replay date. */
export function cacheKey(asOf: IsoDate, q: FailsTogetherRouteQuery): string {
  return JSON.stringify([asOf, q.ward, q.specimen, q.sex ?? null, q.ageGroup ?? null, q.onset ?? null, q.windowDays ?? null]);
}

export function handle(query: FailsTogetherQuery, records: readonly IsolateRecord[]): FailsTogetherResponse {
  return { asOf: query.asOf, failsTogether: failsTogether(records, query), families: families(ANTIBIOTICS) };
}
