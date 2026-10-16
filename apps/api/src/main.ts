import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { buildAlerts, sortAlerts } from "@aei/alerts";
import { alertExplainInput, createLlm, explainAlert, fillSlots, LlmError, llmConfigFromEnv, parseQuestion } from "@aei/ask";
import {
  type ClockCommand,
  type ExplainResponse,
  type IsolateQuery,
  type LiveEvent,
  type Meta,
  type RelationsResponse,
  ROUTES,
} from "@aei/contract";
import { type CoverageResult, coverage, suggest, suggestCombinations } from "@aei/coverage";
import { type Dataset, joinIsolates, loadDataset } from "@aei/dataset";
import { ANTIBIOTICS, type IsolateRecord, ORGANISMS, SPECIMENS, type Specimen, WARDS, type WardCode } from "@aei/domain";
import { antibioticName, phenotypeName, specimenName, wardName } from "@aei/i18n";
import { asResult, type CodeMaps, DEFAULT_CODE_MAPS, detectFormat, extendCodeMaps, ingest, mergeResults } from "@aei/ingest";
import { countFlows, patientMoves, phenotypeTrails, trailLinks } from "@aei/relations";
import { addDays, createReleaseIndex, createReplayClock } from "@aei/replay";

// Development server for the AEI contract (libs/utils/contract). It loads
// the synthetic dataset, replays it day by day and pushes arrivals to
// clients over server-sent events, and takes lab results as they would come
// from a laboratory system (HL7 v2, FHIR or a CSV export) on POST /api/ingest
// (D-035). Wiring only; the logic is in the gears.

const env = process.env;
const llmConfig = llmConfigFromEnv();
const llm = llmConfig && createLlm(llmConfig);
console.log(`[aei-api] AI ${llm ? `on; model ${llmConfig.model}` : "off"}`);
const explanations = new Map<string, ExplainResponse>();
// coverage() takes about 0.25 s (pairs over three levels), so cache by query and replay date.
const coverages = new Map<string, CoverageResult>();
const config = {
  port: Number(env.AEI_PORT ?? 8787),
  dataDir: resolve(env.AEI_DATA_DIR ?? "../../data/synthetic_microbiology_dataset"),
  // Where the replay starts (D-015): by default three weeks before the
  // Urology ESBL E. coli cluster of June 2025 (experiments/0001), so the
  // demo shows a normal ward first and then the outbreak arriving.
  startAt: env.AEI_REPLAY_START ?? "2025-05-12",
  tickMs: Number(env.AEI_TICK_MS ?? 2000),
  daysPerTick: Number(env.AEI_DAYS_PER_TICK ?? 1),
  // Load only results sampled up to this date; later ones can then arrive through /api/ingest.
  loadUntil: env.AEI_LOAD_UNTIL,
  // A JSON file of the site's own codes (see @aei/ingest CodeMaps), merged over the defaults.
  codeMapFile: env.AEI_CODE_MAP,
  guideline: env.AEI_GUIDELINE ?? "",
};
const codeMaps: CodeMaps = config.codeMapFile
  ? extendCodeMaps(JSON.parse(readFileSync(resolve(config.codeMapFile), "utf8")) as Partial<CodeMaps>)
  : DEFAULT_CODE_MAPS;

console.log(`[aei-api] loading ${config.dataDir}`);
const full = await loadDataset(config.dataDir);
const fullDates = full.cultures.map((c) => c.sampleDate).sort();
const datasetStart = fullDates[0] ?? "";
const datasetEnd = fullDates.at(-1) ?? "";
let dataset: Dataset = config.loadUntil ? until(full, config.loadUntil) : full;

function until(d: Dataset, date: string): Dataset {
  const cultures = d.cultures.filter((c) => c.sampleDate <= date);
  const keep = new Set(cultures.map((c) => c.cultureId));
  const isolates = d.isolates.filter((i) => keep.has(i.cultureId));
  const ids = new Set(isolates.map((i) => i.isolateId));
  return { patients: d.patients, cultures, isolates, susceptibility: d.susceptibility.filter((s) => ids.has(s.isolateId)) };
}

// Everything derived from the data, rebuilt when results are ingested. Relation layers and
// alerts depend only on earlier samples, so they are computed over all data and cut to the
// window up to the clock. A result "arrives" on its culture's sample date (D-005).
function derive(d: Dataset) {
  const records = joinIsolates(d);
  const trails = phenotypeTrails(d.cultures, records);
  return {
    records,
    released: createReleaseIndex(records, (r) => r.sampleDate),
    moves: patientMoves(d.cultures),
    trails,
    alerts: createReleaseIndex(buildAlerts(records, d.cultures), (a) => a.date),
  };
}
let state = derive(dataset);
const DEFAULT_RELATION_DAYS = 28;

function relations(asOf: string, days: number): RelationsResponse {
  const window = { from: addDays(asOf, 1 - days), to: asOf };
  return { asOf, ...window, flows: countFlows(state.moves, window), links: trailLinks(state.trails, window) };
}

const clock = createReplayClock({
  start: datasetStart,
  end: datasetEnd,
  asOf: config.loadUntil ?? config.startAt,
  tickMs: config.tickMs,
  daysPerTick: config.daysPerTick,
});

const meta: Meta = {
  ai: Boolean(llm),
  datasetStart,
  datasetEnd,
  wards: WARDS,
  antibiotics: ANTIBIOTICS,
  organisms: ORGANISMS,
  specimens: SPECIMENS,
};

const streams = new Set<ServerResponse>();
function broadcast(event: LiveEvent) {
  const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of streams) res.write(frame);
}

clock.subscribe((now, previous) => {
  if (now.asOf > previous) {
    broadcast({ type: "arrivals", from: previous, to: now.asOf, records: state.released.between(previous, now.asOf) });
    const fresh = state.alerts.between(previous, now.asOf);
    if (fresh.length) broadcast({ type: "alerts", from: previous, to: now.asOf, alerts: sortAlerts(fresh) });
    broadcast({ type: "clock", clock: now });
  } else if (now.asOf < previous) broadcast({ type: "reset", clock: now });
  else broadcast({ type: "clock", clock: now });
});

function matches(r: IsolateRecord, q: IsolateQuery): boolean {
  return (
    (!q.from || r.sampleDate >= q.from) &&
    (!q.to || r.sampleDate <= q.to) &&
    (!q.ward || r.ward === q.ward) &&
    (!q.specimen || r.specimen === q.specimen) &&
    (!q.organism || r.organism === q.organism) &&
    (!q.sex || r.sex === q.sex) &&
    (q.ageMin === undefined || r.ageYears >= q.ageMin) &&
    (q.ageMax === undefined || r.ageYears <= q.ageMax)
  );
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readText(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return JSON.parse((await readText(req)) || "{}");
}

/**
 * Lab results from a laboratory system (D-035): HL7 v2 ORU^R01, a FHIR R4 Bundle
 * or a flat isolate export, detected from the content type or the payload. A
 * culture sent again replaces the earlier one (a corrected or final report).
 * New results are pushed to open clients; if they are dated after the clock, the
 * clock moves to them, as a live feed would.
 */
function ingestPayload(body: string, contentType: string) {
  const format = detectFormat(body, contentType);
  if (!format) return { status: 415, body: { error: "unknown format: send HL7 v2 (MSH...), a FHIR Bundle (JSON) or CSV" } };
  const result = ingest(body, format, { maps: codeMaps, guideline: config.guideline });
  if (!result.cultures.length) return { status: 422, body: { format, accepted: 0, warnings: result.warnings } };
  const before = new Set(state.alerts.upTo(datasetEnd).map((a) => a.id));
  dataset = mergeResults(asResult(dataset), result);
  state = derive(dataset);
  coverages.clear();
  const ids = new Set(result.cultures.map((c) => c.cultureId));
  const arrived = state.records.filter((r) => ids.has(r.cultureId));
  const latest =
    result.cultures
      .map((c) => c.sampleDate)
      .sort()
      .at(-1) ?? "";
  const asOf = clock.state().asOf;
  if (latest > asOf) {
    clock.seek(latest < datasetEnd ? latest : datasetEnd); // the subscription pushes arrivals and alerts
  } else {
    broadcast({ type: "arrivals", from: asOf, to: asOf, records: arrived });
    const fresh = state.alerts.upTo(asOf).filter((a) => !before.has(a.id));
    if (fresh.length) broadcast({ type: "alerts", from: asOf, to: asOf, alerts: sortAlerts(fresh) });
  }
  const newAlerts = state.alerts.upTo(clock.state().asOf).filter((a) => !before.has(a.id));
  return {
    status: 200,
    body: {
      format,
      accepted: result.cultures.length,
      isolates: result.isolates.length,
      results: result.susceptibility.length,
      asOf: clock.state().asOf,
      newAlerts: newAlerts.map((a) => a.id),
      warnings: result.warnings,
    },
  };
}

function runCommand(command: ClockCommand) {
  switch (command.action) {
    case "play":
      return clock.play();
    case "pause":
      return clock.pause();
    case "step":
      return clock.step(command.days);
    case "seek":
      return clock.seek(command.date);
    case "configure":
      return clock.configure(command);
    default:
      throw new Error(`unknown action ${(command as { action: string }).action}`);
  }
}

export const server = createServer(async (req, res) => {
  // The web dev server proxies /api, so CORS is only for other local clients.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === ROUTES.ask && req.method === "POST") {
      if (!llm) return send(res, 503, { error: "AI is not configured" });
      const body = (await readJson(req)) as { text?: unknown; lang?: unknown } | null;
      if (!body || typeof body.text !== "string" || !body.text.trim() || (body.lang !== "en" && body.lang !== "fi")) {
        return send(res, 400, { error: "text and lang (en or fi) are required" });
      }
      const asOf = clock.state().asOf;
      const parsed = await parseQuestion(llm, {
        text: body.text,
        asOf,
        vocabulary: {
          wards: meta.wards.map(({ code, en, fi }) => ({ code, en, fi })),
          organisms: [...meta.organisms],
          specimens: [...meta.specimens],
        },
      });
      return send(res, 200, { asOf, ...parsed });
    }
    if (url.pathname === ROUTES.explain && req.method === "GET") {
      const id = url.searchParams.get("id");
      const lang = url.searchParams.get("lang");
      if (lang !== "en" && lang !== "fi") return send(res, 400, { error: "lang must be en or fi" });
      // The template by default: small models write unreliable Finnish (experiments/0003, D-029).
      const wording = url.searchParams.get("wording") ?? "template";
      if (wording !== "template" && wording !== "model") return send(res, 400, { error: "wording must be template or model" });
      const alert = state.alerts.upTo(clock.state().asOf).find((a) => a.id === id);
      if (!alert) return send(res, 404, { error: "unknown alert" });
      const key = `${alert.id}:${lang}:${wording}`;
      let explanation = explanations.get(key);
      if (!explanation) {
        const input = alertExplainInput(alert, lang, {
          ward: (code) => wardName(lang, code),
          phenotype: phenotypeName,
          organism: (name) => name,
          specimen: (code) => specimenName(lang, code),
          antibiotic: (code) => antibioticName(lang, code),
        });
        const result =
          llm && wording === "model"
            ? await explainAlert(llm, input)
            : { text: fillSlots(input.fallback, input.facts, lang), source: "template" as const };
        explanation = { id: alert.id, ...result };
        explanations.set(key, explanation);
      }
      return send(res, 200, explanation);
    }
    if (url.pathname === ROUTES.coverage) {
      const ward = url.searchParams.get("ward");
      const specimen = url.searchParams.get("specimen");
      const sex = url.searchParams.get("sex");
      const windowDays = url.searchParams.get("windowDays");
      const severity = url.searchParams.get("severity") ?? "mild";
      if (severity !== "mild" && severity !== "severe") return send(res, 400, { error: "severity must be mild or severe" });
      if (!meta.wards.some((w) => w.code === ward)) return send(res, 400, { error: "ward is required and must be a ward code" });
      if (!meta.specimens.some((x) => x.code === specimen)) return send(res, 400, { error: "specimen is required" });
      if (sex !== null && sex !== "F" && sex !== "M") return send(res, 400, { error: "sex must be F or M" });
      const days = windowDays === null ? undefined : Number(windowDays);
      if (days !== undefined && (!Number.isInteger(days) || days < 1))
        return send(res, 400, { error: "windowDays must be a positive integer" });
      const asOf = clock.state().asOf;
      // Only released records, so nothing after the replay date leaks in.
      const key = JSON.stringify([asOf, ward, specimen, sex, days]);
      let result = coverages.get(key);
      if (!result) {
        if (coverages.size > 500) coverages.clear();
        result = coverage(state.released.upTo(asOf), {
          asOf,
          ward: ward as WardCode,
          specimen: specimen as Specimen,
          ...(sex ? { sex } : {}),
          ...(days ? { windowDays: days } : {}),
        });
        coverages.set(key, result);
      }
      return send(res, 200, {
        asOf,
        severity,
        coverage: result,
        suggestions: suggest(result, severity),
        combinationSuggestions: suggestCombinations(result, severity),
      });
    }
    if (url.pathname === ROUTES.ingest && req.method === "POST") {
      const out = ingestPayload(await readText(req), req.headers["content-type"] ?? "");
      return send(res, out.status, out.body);
    }
    if (url.pathname === ROUTES.meta) return send(res, 200, meta);
    if (url.pathname === ROUTES.clock && req.method === "GET") return send(res, 200, clock.state());
    if (url.pathname === ROUTES.clock && req.method === "POST") {
      runCommand((await readJson(req)) as ClockCommand);
      return send(res, 200, clock.state());
    }
    if (url.pathname === ROUTES.isolates) {
      const q = Object.fromEntries(url.searchParams) as IsolateQuery;
      for (const key of ["ageMin", "ageMax"] as const) {
        if (url.searchParams.has(key)) {
          const value = Number(url.searchParams.get(key));
          if (!Number.isInteger(value) || value < 0 || value > 120)
            return send(res, 400, { error: `${key} must be an integer from 0 to 120` });
          q[key] = value;
        }
      }
      const asOf = clock.state().asOf;
      const to = q.to && q.to < asOf ? q.to : asOf;
      return send(res, 200, { asOf, records: state.released.upTo(to).filter((r) => matches(r, { ...q, to })) });
    }
    if (url.pathname === ROUTES.relations) {
      const days = Number(url.searchParams.get("days") ?? DEFAULT_RELATION_DAYS);
      if (!Number.isInteger(days) || days < 1) return send(res, 400, { error: "days must be a positive integer" });
      return send(res, 200, relations(clock.state().asOf, days));
    }
    if (url.pathname === ROUTES.alerts) {
      const asOf = clock.state().asOf;
      const from = url.searchParams.get("from") ?? "";
      return send(res, 200, { asOf, alerts: sortAlerts(state.alerts.upTo(asOf).filter((a) => a.date >= from)) });
    }
    if (url.pathname === ROUTES.live) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: clock\ndata: ${JSON.stringify({ type: "clock", clock: clock.state() })}\n\n`);
      streams.add(res);
      req.on("close", () => streams.delete(res));
      return;
    }
    send(res, 404, { error: `no route ${url.pathname}` });
  } catch (error) {
    send(res, error instanceof LlmError ? 502 : 400, { error: error instanceof LlmError ? "The assistant is unavailable" : String(error) });
  }
});

server.listen(config.port, () => {
  console.log(`[aei-api] ${state.records.length} isolates, ${datasetStart} to ${datasetEnd}; replay at ${clock.state().asOf}`);
  console.log(`[aei-api] ${state.moves.length} unit moves, ${state.trails.length} carrier trails, ${state.alerts.size} alerts`);
  console.log(`[aei-api] http://localhost:${config.port}${ROUTES.meta}`);
});
