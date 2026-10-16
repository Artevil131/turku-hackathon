import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { buildAlerts, sortAlerts } from "@aei/alerts";
import { type ClockCommand, type IsolateQuery, type LiveEvent, type Meta, type RelationsResponse, ROUTES } from "@aei/contract";
import { joinIsolates, loadDataset } from "@aei/dataset";
import { ANTIBIOTICS, type IsolateRecord, ORGANISMS, SPECIMENS, WARDS } from "@aei/domain";
import { countFlows, patientMoves, phenotypeTrails, trailLinks } from "@aei/relations";
import { addDays, createReleaseIndex, createReplayClock } from "@aei/replay";

// Development server for the AEI contract (libs/utils/contract). It loads
// the synthetic dataset, replays it day by day and pushes arrivals to
// clients over server-sent events. Wiring only; the logic is in the gears.

const env = process.env;
const config = {
  port: Number(env.AEI_PORT ?? 8787),
  dataDir: resolve(env.AEI_DATA_DIR ?? "../../data/synthetic_microbiology_dataset"),
  // Where the replay starts (D-015): by default three weeks before the
  // Urology ESBL E. coli cluster of June 2025 (experiments/0001), so the
  // demo shows a normal ward first and then the outbreak arriving.
  startAt: env.AEI_REPLAY_START ?? "2025-05-12",
  tickMs: Number(env.AEI_TICK_MS ?? 2000),
  daysPerTick: Number(env.AEI_DAYS_PER_TICK ?? 1),
};

console.log(`[aei-api] loading ${config.dataDir}`);
const dataset = await loadDataset(config.dataDir);
const records = joinIsolates(dataset);
// A result "arrives" on its culture's sample date, the only date the data has.
const released = createReleaseIndex(records, (r) => r.sampleDate);
const dates = records.map((r) => r.sampleDate).sort();
const datasetStart = dates[0] ?? "";
const datasetEnd = dates.at(-1) ?? "";

// Relation layers and alerts depend only on earlier samples, so they are
// computed once over all data and cut to the window up to the clock.
const moves = patientMoves(dataset.cultures);
const trails = phenotypeTrails(dataset.cultures, records);
const alerts = createReleaseIndex(buildAlerts(records, dataset.cultures, trails), (a) => a.date);
const DEFAULT_RELATION_DAYS = 28;

function relations(asOf: string, days: number): RelationsResponse {
  const window = { from: addDays(asOf, 1 - days), to: asOf };
  return { asOf, ...window, flows: countFlows(moves, window), links: trailLinks(trails, window) };
}

const clock = createReplayClock({
  start: datasetStart,
  end: datasetEnd,
  asOf: config.startAt,
  tickMs: config.tickMs,
  daysPerTick: config.daysPerTick,
});

const meta: Meta = { datasetStart, datasetEnd, wards: WARDS, antibiotics: ANTIBIOTICS, organisms: ORGANISMS, specimens: SPECIMENS };

const streams = new Set<ServerResponse>();
function broadcast(event: LiveEvent) {
  const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of streams) res.write(frame);
}

clock.subscribe((state, previous) => {
  if (state.asOf > previous) {
    broadcast({ type: "arrivals", from: previous, to: state.asOf, records: released.between(previous, state.asOf) });
    const fresh = alerts.between(previous, state.asOf);
    if (fresh.length) broadcast({ type: "alerts", from: previous, to: state.asOf, alerts: sortAlerts(fresh) });
    broadcast({ type: "clock", clock: state });
  } else if (state.asOf < previous) broadcast({ type: "reset", clock: state });
  else broadcast({ type: "clock", clock: state });
});

function matches(r: IsolateRecord, q: IsolateQuery): boolean {
  return (
    (!q.from || r.sampleDate >= q.from) &&
    (!q.to || r.sampleDate <= q.to) &&
    (!q.ward || r.ward === q.ward) &&
    (!q.specimen || r.specimen === q.specimen) &&
    (!q.organism || r.organism === q.organism)
  );
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
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

const server = createServer(async (req, res) => {
  // The web dev server proxies /api, so CORS is only for other local clients.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === ROUTES.meta) return send(res, 200, meta);
    if (url.pathname === ROUTES.clock && req.method === "GET") return send(res, 200, clock.state());
    if (url.pathname === ROUTES.clock && req.method === "POST") {
      runCommand((await readJson(req)) as ClockCommand);
      return send(res, 200, clock.state());
    }
    if (url.pathname === ROUTES.isolates) {
      const q = Object.fromEntries(url.searchParams) as IsolateQuery;
      const asOf = clock.state().asOf;
      const to = q.to && q.to < asOf ? q.to : asOf;
      return send(res, 200, { asOf, records: released.upTo(to).filter((r) => matches(r, { ...q, to })) });
    }
    if (url.pathname === ROUTES.relations) {
      const days = Number(url.searchParams.get("days") ?? DEFAULT_RELATION_DAYS);
      if (!Number.isInteger(days) || days < 1) return send(res, 400, { error: "days must be a positive integer" });
      return send(res, 200, relations(clock.state().asOf, days));
    }
    if (url.pathname === ROUTES.alerts) {
      const asOf = clock.state().asOf;
      const from = url.searchParams.get("from") ?? "";
      return send(res, 200, { asOf, alerts: sortAlerts(alerts.upTo(asOf).filter((a) => a.date >= from)) });
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
    send(res, 400, { error: String(error) });
  }
});

server.listen(config.port, () => {
  console.log(`[aei-api] ${records.length} isolates, ${datasetStart} to ${datasetEnd}; replay at ${clock.state().asOf}`);
  console.log(`[aei-api] ${moves.length} unit moves, ${trails.length} carrier trails, ${alerts.size} alerts`);
  console.log(`[aei-api] http://localhost:${config.port}${ROUTES.meta}`);
});
