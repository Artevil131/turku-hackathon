import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { type ClockCommand, type IsolateQuery, type LiveEvent, type Meta, ROUTES } from "@aei/contract";
import { joinIsolates, loadDataset } from "@aei/dataset";
import { ANTIBIOTICS, type IsolateRecord, ORGANISMS, SPECIMENS, WARDS } from "@aei/domain";
import { createReleaseIndex, createReplayClock } from "@aei/replay";

// Development server for the AEI contract (libs/utils/contract). It loads
// the synthetic dataset, replays it day by day and pushes arrivals to
// clients over server-sent events. Wiring only; the logic is in the gears.

const env = process.env;
const config = {
  port: Number(env.AEI_PORT ?? 8787),
  dataDir: resolve(env.AEI_DATA_DIR ?? "../../data/synthetic_microbiology_dataset"),
  // Where the replay starts; by default eight weeks before the data ends,
  // so the four-week window is full from the first screen.
  startAt: env.AEI_REPLAY_START,
  tickMs: Number(env.AEI_TICK_MS ?? 2000),
  daysPerTick: Number(env.AEI_DAYS_PER_TICK ?? 1),
};

console.log(`[aei-api] loading ${config.dataDir}`);
const records = joinIsolates(await loadDataset(config.dataDir));
// A result "arrives" on its culture's sample date, the only date the data has.
const released = createReleaseIndex(records, (r) => r.sampleDate);
const dates = records.map((r) => r.sampleDate).sort();
const datasetStart = dates[0] ?? "";
const datasetEnd = dates.at(-1) ?? "";
const defaultStart = new Date(Date.parse(`${datasetEnd}T00:00:00Z`) - 56 * 86_400_000).toISOString().slice(0, 10);

const clock = createReplayClock({
  start: datasetStart,
  end: datasetEnd,
  asOf: config.startAt ?? defaultStart,
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
  console.log(`[aei-api] http://localhost:${config.port}${ROUTES.meta}`);
});
