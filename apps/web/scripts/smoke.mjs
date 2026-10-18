// Smoke test: render every screen at desktop and phone size in a real Chrome and fail loudly on breakage.
// No dependencies beyond Node 22 and a Chrome or Chromium binary, driven over the DevTools protocol.
//
//   pnpm smoke                                   # starts API + web on the real dataset, clock 2025-06-10
//   pnpm smoke -- --fixture                      # the small committed fixture instead (what CI runs)
//   SMOKE_URL=http://localhost:5173 pnpm smoke   # test an app that is already running
//
// Options: --data DIR, --as-of YYYY-MM-DD, --api-port 8798, --web-port 5176, --out DIR (default
// apps/web/smoke-out), --desktop WxH (laptop sizes, default 1440x1000), --routes home,doctor,... (home is the empty hash), --interactions all|doctor|name,..., --headed. Chrome comes from $CHROME, else google-chrome,
// google-chrome-stable, chromium or chromium-browser on the PATH.
//
// Per route and viewport it checks: no uncaught exception or console error, no /api request that failed or
// answered 400 or more, exactly one visible main heading (h1) with text, the sidebar (nav.sidebar, a drawer on
// phones) present, no horizontal page overflow, at least one visible control, and the page finished loading.
// Old routes (#research, #workspace, #connect) must land on their new pages.
// Interactions cover navigation between the tabs, stepping the replay clock one day from the timeline, language
// switching, opening a signal on the research page (its isolates appear), the search ("/" then "uro") and
// eight concurrent tabs. Writes a PNG per check and report.md / report.json to
// the output directory, and exits 1 if anything failed.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(WEB, "../..");
const FIXTURE = join(WEB, "scripts/smoke-fixture");

// ---------- options ----------
const argv = process.argv.slice(2).filter((a) => a !== "--");
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const fixture = flag("fixture");
const dataDir = resolve(opt("data", fixture ? FIXTURE : join(ROOT, "data/synthetic_microbiology_dataset")));
const asOf = opt("as-of", fixture ? "2025-05-22" : "2025-06-10");
const apiPort = Number(opt("api-port", "8798"));
const webPort = Number(opt("web-port", "5176"));
const outDir = resolve(opt("out", join(WEB, "smoke-out")));
const interactionGroup = opt("interactions", "all");
const ROUTES = opt("routes", "start,project,research,workspace,data,connect,method,settings").split(",");
const INTERACTIONS = interactionGroup === "all" || interactionGroup === "doctor" ? [] : interactionGroup.split(",").filter(Boolean);
// --desktop 1366x768 runs the desktop checks and interactions at a laptop-sized window instead of 1440x1000.
const desktopSize = /^(\d+)x(\d+)$/.exec(opt("desktop", "1440x1000")) ?? ["", "1440", "1000"];
const VIEWPORTS = [
  { name: "desktop", width: Number(desktopSize[1]), height: Number(desktopSize[2]), mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];
const external = process.env.SMOKE_URL?.replace(/\/$/, "");
// A route name is its hash; home is the empty hash.
const hashOf = (route) => (route === "home" ? "" : `#${route}`);
// Where an old route lands now: the project view replaced the workspace, Data replaced Connect.
const LANDS = { start: "#start", research: "#project", workspace: "#project", doctor: "#project", connect: "#data", method: "#data" };
const landingOf = (route) => LANDS[route] ?? hashOf(route);
const urlOf = (route) => `${base}/${hashOf(route)}`;
const base = external ?? `http://localhost:${webPort}`;

// ---------- processes ----------
const children = [];
function start(cmd, args, cwd, env, label) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  const keep = (b) => {
    log = (log + b.toString()).slice(-4000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  children.push({ child, label, log: () => log });
  return child;
}
function stopAll() {
  for (const { child } of children) if (child.exitCode === null) child.kill("SIGTERM");
}
process.on("exit", stopAll);
process.on("SIGINT", () => process.exit(130));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url, label, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    const dead = children.find((c) => c.child.exitCode !== null);
    if (dead) throw new Error(`${dead.label} exited early:\n${dead.log()}`);
    await sleep(250);
  }
  throw new Error(`${label} not ready at ${url} after ${timeoutMs / 1000} s`);
}

function findChrome() {
  const names = [process.env.CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const n of names) {
    if (n.includes("/") && existsSync(n)) return n;
    const which = spawnSync("sh", ["-c", `command -v ${n}`], { encoding: "utf8" });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  throw new Error("No Chrome found: set CHROME to a Chrome or Chromium binary");
}

// ---------- a minimal DevTools protocol client ----------
async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "aei-smoke-"));
  const args = [
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-sandbox",
    ...(flag("headed") ? [] : ["--headless=new"]),
    "about:blank",
  ];
  start(findChrome(), args, ROOT, {}, "chrome");
  const portFile = join(profile, "DevToolsActivePort");
  const until = Date.now() + 20_000;
  while (!existsSync(portFile) || !readFileSync(portFile, "utf8").includes("\n")) {
    if (Date.now() > until) throw new Error("Chrome did not open its DevTools port");
    await sleep(100);
  }
  const [port, path] = readFileSync(portFile, "utf8").split("\n");
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve: ok, reject, timer } = pending.get(m.id);
      clearTimeout(timer);
      pending.delete(m.id);
      if (m.error) reject(new Error(`${m.error.message}`));
      else ok(m.result);
    } else if (m.method) for (const l of listeners) l(m);
  });
  // One protocol call; `sessionId` addresses a tab. Nothing may hang the run: every call gives up after 30 s.
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, reject) => {
      const i = ++id;
      const timer = setTimeout(() => {
        pending.delete(i);
        reject(new Error(`${method} got no answer in 30 s`));
      }, 30_000);
      pending.set(i, { resolve: ok, reject, timer });
      ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  // A fresh tab per check, closed afterwards: its live stream closes with it, so no check inherits connections
  // from the last one (HTTP/1.1 allows six per host, and the app holds one open per page).
  const newPage = async (viewport) => {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const own = new Set();
    const relay = (m) => {
      if (m.sessionId === sessionId) for (const l of own) l(m);
    };
    listeners.add(relay);
    const page = {
      send: (method, params) => send(method, params, sessionId),
      on: (l) => own.add(l),
      off: (l) => own.delete(l),
      close: async () => {
        listeners.delete(relay);
        await send("Target.closeTarget", { targetId }).catch(() => {});
      },
    };
    for (const domain of ["Page", "Runtime", "Network", "Log"]) await page.send(`${domain}.enable`);
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    });
    return page;
  };
  const cleanup = () => {
    ws.close();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  };
  return { newPage, cleanup, send, on: (l) => listeners.add(l), off: (l) => listeners.delete(l) };
}

// ---------- page helpers ----------
async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

/** Collects console errors, exceptions and failed /api requests while `body` runs. */
async function watching(cdp, body) {
  const problems = { console: [], exceptions: [], api: [], other: [] };
  const urls = new Map();
  const inflight = new Map(); // requestId -> start time
  let lastActivity = Date.now();
  const l = (m) => {
    const p = m.params;
    if (m.method === "Runtime.exceptionThrown")
      problems.exceptions.push(p.exceptionDetails.exception?.description?.split("\n")[0] ?? p.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "assert"))
      problems.console.push(
        p.args
          .map((a) => a.value ?? a.description ?? "")
          .join(" ")
          .slice(0, 300),
      );
    if (m.method === "Log.entryAdded" && p.entry.level === "error" && p.entry.source !== "network")
      problems.console.push(`${p.entry.source}: ${p.entry.text}`.slice(0, 300));
    if (m.method === "Network.requestWillBeSent") {
      urls.set(p.requestId, p.request.url);
      if (process.env.SMOKE_DEBUG && p.request.url.includes("/api/"))
        console.log(`  ${((Date.now() % 100000) / 1000).toFixed(1)} -> ${p.request.method} ${p.request.url.replace(base, "")}`);
      // The live stream never ends, and a worker's script finishes in the worker's own session.
      if (!p.request.url.includes("/api/live") && !p.request.url.includes("worker_file")) inflight.set(p.requestId, Date.now());
      lastActivity = Date.now();
    }
    if (m.method === "Network.responseReceived") {
      const u = p.response.url;
      // /api/regional (D-037), /api/counties (D-043) and /api/national (D-048) answer 404 when their files are not mounted, as in CI
      // where data/ is not in git: the app shows an empty state, so a warning, not a failure.
      const optional = p.response.status === 404 && ["/api/regional", "/api/counties", "/api/national"].some((r) => u.includes(r));
      if (p.response.status >= 400)
        (u.includes("/api/") && !optional ? problems.api : problems.other).push(`${p.response.status} ${u.replace(base, "")}`);
    }
    if (
      process.env.SMOKE_DEBUG &&
      (m.method === "Network.loadingFinished" || m.method === "Network.loadingFailed") &&
      (urls.get(p.requestId) ?? "").includes("/api/")
    )
      console.log(
        `  ${((Date.now() % 100000) / 1000).toFixed(1)} <- ${m.method.slice(8)} ${(urls.get(p.requestId) ?? "").replace(base, "")}${p.canceled ? " canceled" : ""}`,
      );
    if (m.method === "Network.loadingFinished" || m.method === "Network.loadingFailed") {
      inflight.delete(p.requestId);
      lastActivity = Date.now();
    }
    if (m.method === "Network.loadingFailed" && !p.canceled) {
      const u = urls.get(p.requestId) ?? "?";
      (u.includes("/api/") ? problems.api : problems.other).push(`${p.errorText} ${u.replace(base, "")}`);
    }
  };
  cdp.on(l);
  const idle = async (quietMs = 700, maxMs = 20_000) => {
    const until = Date.now() + maxMs;
    while (Date.now() < until) {
      for (const [rid, t] of inflight) if (Date.now() - t > 5000) inflight.delete(rid);
      if (inflight.size === 0 && Date.now() - lastActivity > quietMs) return true;
      await sleep(100);
    }
    if (process.env.SMOKE_DEBUG) console.log(`  not idle after ${maxMs} ms: ${[...inflight.keys()].map((i) => urls.get(i)).join(", ")}`);
    return false;
  };
  try {
    await body(idle);
  } finally {
    cdp.off(l);
  }
  return problems;
}

// "Busy" is any aria-busy region in the page: the pages mark their lists and panels while they fetch.
const READY = `(() => {
  const root = document.querySelector("main");
  return !!root && !root.querySelector("[aria-busy=true]") && !!root.querySelector("h1")?.textContent.trim();
})()`;

async function load(cdp, url, idle) {
  await cdp.send("Page.navigate", { url });
  // Ready when the page has its heading, nothing in it says it is busy and the network is quiet.
  const until = Date.now() + 25_000;
  while (Date.now() < until) {
    const ready = await evaluate(cdp, READY).catch(() => false);
    if (ready) break;
    await sleep(150);
  }
  await idle();
  await sleep(400); // let charts and transitions settle before the picture
}

const CHECKS = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const root = document.querySelector("main");
  const h1s = [...(root ? root.querySelectorAll("h1") : [])].filter(vis);
  const controls = [...(root ? root.querySelectorAll("button, a[href], input, select, [role=radio], [role=tab]") : [])].filter(vis);
  return {
    heading: h1s[0] ? h1s[0].textContent.trim().replace(/\\s+/g, " ") : "",
    headings: h1s.length,
    sidebar: !!document.querySelector("nav.sidebar"),
    busy: !!root?.querySelector("[aria-busy=true]"),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    controls: controls.length,
    hash: location.hash,
  };
})()`;

async function screenshot(cdp, file) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(shot.data, "base64"));
}

function judge(problems, extra = []) {
  const reasons = [...extra];
  for (const e of problems.exceptions) reasons.push(`exception: ${e}`);
  for (const c of problems.console) reasons.push(`console error: ${c}`);
  for (const a of problems.api) reasons.push(`api: ${a}`);
  return reasons;
}

// ---------- main ----------
async function main() {
  mkdirSync(outDir, { recursive: true });
  if (!external) {
    if (!existsSync(join(dataDir, "cultures.csv"))) throw new Error(`no dataset at ${dataDir} (use --fixture, --data DIR or SMOKE_URL)`);
    start(
      process.execPath,
      ["src/main.ts"],
      join(ROOT, "apps/api"),
      {
        AEI_PORT: String(apiPort),
        AEI_DATA_DIR: dataDir,
        AEI_REPLAY_START: asOf,
        AEI_LLM_URL: "",
      },
      "api",
    );
    start(
      join(WEB, "node_modules/.bin/vite"),
      ["--port", String(webPort), "--strictPort"],
      WEB,
      { AEI_API_URL: `http://localhost:${apiPort}` },
      "web",
    );
    await waitFor(`http://localhost:${apiPort}/api/meta`, "API");
  }
  await waitFor(`${base}/`, "web");
  const api = (path, init) => fetch(`${base}${path}`, init).then((r) => r.json());
  const clock0 = await api("/api/clock");

  const browser = await launchChrome();

  const rows = [];
  const t0 = Date.now();
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      let info = null;
      const file = join(outDir, `${route}-${vp.name}.png`);
      const cdp = await browser.newPage(vp);
      const problems = await watching(cdp, async (idle) => {
        await load(cdp, urlOf(route), idle);
        info = await evaluate(cdp, CHECKS);
        await screenshot(cdp, file);
      });
      await cdp.close();
      const extra = [];
      if (!info.heading) extra.push("no visible main heading (h1)");
      if (info.headings > 1) extra.push(`${info.headings} visible h1 headings, expected one`);
      if (!info.sidebar) extra.push("sidebar (nav.sidebar) missing");
      if (info.busy) extra.push("still loading (aria-busy) after 25 s");
      if (info.overflow > 1) extra.push(`page ${info.overflow}px wider than the viewport`);
      if (info.controls === 0) extra.push("no visible control in the page");
      // A page may add its own params to the hash (#doctor?unit=MED-A); only the page part is compared.
      if (info.hash.split("?")[0] !== landingOf(route)) extra.push(`landed on ${info.hash || "(home)"}`);
      const reasons = judge(problems, extra);
      rows.push({
        check: route === "home" ? "home" : `#${route}`,
        viewport: vp.name,
        ok: reasons.length === 0,
        heading: info.heading,
        reasons,
        warnings: problems.other,
        file,
      });
      console.log(`${reasons.length ? "FAIL" : "ok  "} ${route} ${vp.name}${reasons.length ? `: ${reasons.join("; ")}` : ""}`);
    }
  }

  // ---------- interactions (desktop) ----------
  let cdp = null;
  // Reads that must see what the browser sees (its own replay clock and projects, keyed by its visitor cookie;
  // D-078, D-084) go through the page; Node's own fetch carries no cookie.
  const pageApi = (path) => evaluate(cdp, `fetch(${JSON.stringify(path)}).then((r) => r.json())`);
  const interaction = async (name, body, viewport = VIEWPORTS[0]) => {
    if (interactionGroup === "doctor" && !name.startsWith("doctor-")) return;
    if (INTERACTIONS.length && !INTERACTIONS.includes(name)) return;
    const reasons = [];
    const file = join(outDir, `interaction-${name}.png`);
    cdp = await browser.newPage(viewport);
    const problems = await watching(cdp, async (idle) => {
      try {
        await body(idle, reasons);
      } catch (e) {
        reasons.push(String(e.message ?? e));
      }
      await screenshot(cdp, file).catch(() => {});
    });
    await cdp.close();
    const all = judge(problems, reasons);
    rows.push({ check: name, viewport: viewport.name, ok: all.length === 0, heading: "", reasons: all, warnings: problems.other, file });
    console.log(`${all.length ? "FAIL" : "ok  "} ${name}${all.length ? `: ${all.join("; ")}` : ""}`);
  };
  const waitIn = async (expr, ms = 8000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (await evaluate(cdp, expr).catch(() => false)) return true;
      await sleep(150);
    }
    return false;
  };

  // Doctor regressions: real hit-testing after scrolling, not only programmatic clicks.
  for (const vp of VIEWPORTS) {
    await interaction(
      `doctor-usability-${vp.name}`,
      async (idle, reasons) => {
        // Age group and onset are live filters (D-049, D-053): a link carrying them keeps them and presses their controls.
        await load(cdp, `${urlOf("doctor")}?age=older&onset=hospital`, idle);
        const initial = await evaluate(
          cdp,
          `(() => {
        const row = document.querySelector('.cl-row');
        return { row: row?.textContent, disclosure: document.querySelector('.cl-disclosure')?.textContent,
          liveInUrl: location.hash.includes('age=older') && location.hash.includes('onset=hospital') };
      })()`,
        );
        if (!/kaikki (kasvavat|bakteerit)/.test(initial.row ?? "")) reasons.push("unopened row omits all-growth denominator");
        if (!initial.disclosure?.includes("ei potilashoitoon") || !initial.disclosure?.includes("Tukee päätöstä"))
          reasons.push("demo/decision disclosure missing");
        if (!initial.liveInUrl) reasons.push("age group or onset did not stay in the link");
        await evaluate(cdp, `document.querySelector('.rs-sumrow')?.click()`);
        const controls = await evaluate(
          cdp,
          `(() => { const pressed = [...document.querySelectorAll('.rs-choice[aria-pressed=true]')].map((b) => b.textContent);
        return { disabled: document.querySelectorAll('.rs-choice:disabled').length, age: pressed.includes('65+'),
          onset: !!document.querySelector('.rs-toggle[aria-pressed=true]') }; })()`,
        );
        if (controls.disabled !== 0) reasons.push(`expected no disabled filter controls, saw ${controls.disabled}`);
        if (!controls.age || !controls.onset) reasons.push("age group or onset control not shown as chosen");
        // Blood and severe, set through the URL the way a shared link would (the filters follow the hash).
        await evaluate(
          cdp,
          `(() => { const q = new URLSearchParams(location.hash.split('?')[1] ?? ''); q.set('cov.site', 'blood'); q.set('cov.sev', 'severe'); location.hash = 'project?' + q; return true; })()`,
        );
        if (
          !(await waitIn(
            `location.hash.includes('cov.site=blood') && location.hash.includes('cov.sev=severe') && !!document.querySelector('.cl[aria-busy=false] .cl-row')`,
          ))
        )
          reasons.push("blood + severe did not load coverage");
        await idle();
        await screenshot(cdp, join(outDir, `doctor-severe-${vp.name}.png`));
        const pair = await evaluate(
          cdp,
          `(() => { const b = document.querySelector('.cl-pair-summary button'); if (!b) return null; b.click(); return !!document.querySelector('.cl-pair-summary')?.textContent.includes('Yksikään antibiootti'); })()`,
        );
        if (pair === false) reasons.push("combination summary omits reason");
        if (pair !== null) {
          if (!(await waitIn(`!!document.querySelector('.cl-row[aria-expanded=true]')`)))
            reasons.push("combination summary did not open its details");
          // Phone closes the drawer; desktop has no drawer, so collapse the open row before the tap below.
          await evaluate(
            cdp,
            `(() => { const c = document.querySelector('.dp-close'); if (c) c.click(); else document.querySelector('.cl-row[aria-expanded=true]')?.click(); return true; })()`,
          );
        }
        await evaluate(cdp, `document.querySelector('.cl-li:last-child .cl-row')?.scrollIntoView({block:'end'})`);
        const target = await evaluate(
          cdp,
          `(() => {
        const b = document.querySelector('.cl-li:last-child .cl-row');
        const r = b?.getBoundingClientRect(); const d = b?.querySelector('.cl-details')?.getBoundingClientRect();
        if (!r || !d) return null;
        const x = d.x + d.width/2, y = d.y + d.height/2;
        return {x,y, height:r.height, width:r.width, hit:b.contains(document.elementFromPoint(x,y))};
      })()`,
        );
        if (!target?.hit || target.height < 44 || target.width < 44) reasons.push("bottom row details target is obscured or below 44x44");
        else {
          await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 });
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 });
          if (
            !(await waitIn(`!!document.querySelector('.cl-row[aria-expanded=true]') && !!document.querySelector('#dr-details .dt-name')`))
          )
            reasons.push("real tap did not open antibiotic details");
          if (!(await evaluate(cdp, `location.hash.startsWith('#project') && !document.querySelector('.cmd[data-expanded]')`)))
            reasons.push("details tap opened navigation or search");
          await screenshot(cdp, join(outDir, `doctor-details-${vp.name}.png`));
        }
        await evaluate(
          cdp,
          `document.querySelector('.dp-close')?.click(); document.querySelector('.cl-disclosure .data-quality a')?.click()`,
        );
        if (!(await waitIn(`location.hash === '#data?section=quality' && !!document.querySelector('#data-quality .quality-results')`)))
          reasons.push("source line did not lead to loaded quality checks");
      },
      vp,
    );
  }

  // The sidebar is the navigation: Home, an open view, Data and Settings, each marked current when shown.
  await interaction("tabs", async (idle, reasons) => {
    await load(cdp, urlOf("research"), idle);
    const steps = [
      [".sb-home", "", ".sb-home"],
      ['.sb-tab[data-tab="view"] .sb-item', "#project", '.sb-tab[data-tab="view"] .sb-item'],
      ["[data-page-data]", "#data", "[data-page-data]"],
      ["[data-settings]", "#settings", "[data-settings]"],
      [".sb-home", "", ".sb-home"],
    ];
    for (const [selector, hash, current] of steps) {
      const target = current ?? `.sb-item[aria-current="page"]`;
      await evaluate(cdp, `[...document.querySelectorAll(${JSON.stringify(selector)})].at(-1)?.click()`);
      const ok = await waitIn(
        `location.hash.split("?")[0] === ${JSON.stringify(hash)} && document.querySelector(${JSON.stringify(target)})?.getAttribute("aria-current") === "page" && !!document.querySelector("main h1")?.textContent.trim()`,
        15_000,
      );
      if (!ok) {
        const seen = await evaluate(cdp, `location.hash + " | h1: " + (document.querySelector("main h1")?.textContent ?? "none")`);
        reasons.push(`sidebar ${selector}: not current with a heading 15 s after the click (${seen})`);
      }
      await idle();
    }
    // The rail keeps every destination; its state is remembered.
    await evaluate(cdp, `document.querySelector(".sb-collapse").click()`);
    if (
      !(await waitIn(
        `!!document.querySelector('.sidebar[data-rail]') && document.querySelector('.sidebar').getBoundingClientRect().width < 80`,
      ))
    )
      reasons.push("the sidebar did not collapse to a rail");
    await screenshot(cdp, join(outDir, "sidebar-rail.png"));
    await evaluate(cdp, `document.querySelector(".sb-collapse").click()`);
    if (!(await waitIn(`!document.querySelector('.sidebar[data-rail]')`))) reasons.push("the rail did not expand again");
  });

  // The replay clock is shared by a running app; the run puts it back at the end (see "seek" below).
  await interaction("step-one-day", async (idle, reasons) => {
    await load(cdp, urlOf("project"), idle);
    const readout = `document.querySelector(".viewbar .clock-readout")?.textContent ?? ""`;
    const before = await evaluate(cdp, readout);
    if (!before || before === "–") reasons.push("no as-of date in the replay clock");
    const clicked = await evaluate(
      cdp,
      `(() => {
      const b = document.querySelector('.viewbar .clock [data-step="1"]');
      if (!b || b.disabled) return false; b.click(); return true; })()`,
    );
    if (!clicked) {
      reasons.push("no enabled step-one-day button in the replay clock");
      return;
    }
    const changed = await waitIn(`(${readout}) !== ${JSON.stringify(before)} && !document.querySelector(".clock[aria-busy]")`, 15_000);
    if (!changed) reasons.push(`as-of date still "${before}" 15 s after stepping one day`);
    await idle();
  });

  await interaction("language", async (idle, reasons) => {
    // The language is chosen only in Settings; the header has no switch.
    await load(cdp, urlOf("settings"), idle);
    if (await evaluate(cdp, `!!document.querySelector(".sidebar button[lang]")`)) reasons.push("a language button in the sidebar");
    const before = await evaluate(cdp, `document.documentElement.lang`);
    const nav = await evaluate(cdp, `document.querySelector("nav.sidebar")?.textContent ?? ""`);
    const clicked = await evaluate(
      cdp,
      `(() => {
      const b = document.querySelector(".settings button[lang][aria-pressed='false']");
      if (!b) return false; b.click(); return b.getAttribute("lang"); })()`,
    );
    if (!clicked) {
      reasons.push("no language choice in Settings");
      return;
    }
    if (clicked === before) reasons.push(`the language button offers "${clicked}", the page is already in it`);
    const changed = await waitIn(`document.documentElement.lang === ${JSON.stringify(clicked)}`);
    if (!changed) reasons.push(`html lang still "${before}" after choosing "${clicked}"`);
    if (!(await waitIn(`(document.querySelector("nav.sidebar")?.textContent ?? "") !== ${JSON.stringify(nav)}`)))
      reasons.push(`sidebar labels unchanged after choosing "${clicked}"`);
    await idle();
  });

  // Real pointer events, not element.click(): reparenting on pointerdown used to swallow close clicks.
  const pointOf = (selector) =>
    evaluate(
      cdp,
      `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('Missing control: ' + ${JSON.stringify(selector)});
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!el.contains(document.elementFromPoint(x, y))) throw new Error('Control covered: ' + ${JSON.stringify(selector)});
    return { x, y };
  })()`,
    );
  const mouse = async (type, p, extra = {}) => {
    // A physical pointer enters its target before pressing. CDP press coordinates alone do not move it.
    if (type === "mousePressed") await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...p });
    return cdp.send("Input.dispatchMouseEvent", { type, ...p, ...extra });
  };
  const click = async (selector, clickCount = 1) => {
    const p = await pointOf(selector);
    await mouse("mousePressed", p, { button: "left", buttons: 1, clickCount });
    await mouse("mouseReleased", p, { button: "left", buttons: 0, clickCount });
  };
  const key = async (key, modifiers = 0) => {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, modifiers });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, modifiers });
  };
  const cleanWorkspace = async (idle) => {
    await load(cdp, urlOf("research"), idle);
    await evaluate(
      cdp,
      `localStorage.removeItem('aei.research.layout'); localStorage.removeItem('aei.research.focus'); localStorage.removeItem('aei.research.rail')`,
    );
    await cdp.send("Page.navigate", { url: "about:blank" });
    await load(cdp, urlOf("research"), idle);
  };
  // The free-grid workspace (the 11:00 version Artem asked back): close a window with its real
  // close button, reopen it from the tray, apply a ready-made layout.
  await interaction(
    "research-workspace",
    async (idle, reasons) => {
      await cleanWorkspace(idle);
      const open = `[...document.querySelectorAll('.ws-win')].map(w => w.dataset.win).sort().join(',')`;
      if (!(await waitIn(`!!document.querySelector('#ws-win-map')`, 3000))) reasons.push("the Map window is not open by default");
      await click("#ws-win-map .ws-close");
      if (!(await waitIn(`!document.querySelector('#ws-win-map')`, 1500))) reasons.push("the Map window did not close");
      await click("#ws-tray-button");
      await click('[data-toggle="map"]');
      if (!(await waitIn(`!!document.querySelector('#ws-win-map')`, 1500))) reasons.push("the Map window did not reopen from the tray");
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape" });
      const before = await evaluate(cdp, `document.querySelector('#ws-win-map').getBoundingClientRect().width`);
      await click('[data-preset="map"]');
      if (!(await waitIn(`document.querySelector('#ws-win-map').getBoundingClientRect().width > ${before} + 40`, 1500)))
        reasons.push("the Map layout did not widen the map window");
      if (!(await evaluate(cdp, `localStorage.getItem('aei.research.layout') !== null`))) reasons.push("the layout was not saved");
      await click('[data-preset="default"]');
      if (!(await waitIn(`${open} === 'graph,map,notebook,signals'`, 1500)))
        reasons.push(`default layout: open windows ${await evaluate(cdp, open)}`);
      // A selected row opens the card as a layer inside the Signals window (the primary window); Back returns.
      await evaluate(cdp, `document.querySelector('.feed-row')?.click()`);
      if (!(await waitIn(`!!document.querySelector('.ws-win[data-role="primary"]')`, 3000)))
        reasons.push("selecting a signal gave no primary window");
      if (!(await waitIn(`!!document.querySelector('#ws-win-signals .feed-pane-card .math .sig-back')`, 3000)))
        reasons.push("the signal card did not open as a layer in the Signals window");
      // Focus mode: F enlarges the selected window and leaves the others in the rail; Esc leaves focus, then
      // closes the card layer (the layer's own Escape is left to it once focus mode is gone).
      await key("f");
      if (!(await waitIn(`${open} === 'signals' && document.querySelector('#ws-win-signals').getBoundingClientRect().width > 1000`, 1500)))
        reasons.push(`F did not focus the Signals window (open: ${await evaluate(cdp, open)})`);
      if (!(await waitIn(`!!document.querySelector('[data-focus-leave]') && !!document.querySelector('[data-focus-win="map"]')`, 1500)))
        reasons.push("focus mode shows no rail of the other windows");
      await key("Escape");
      if (!(await waitIn(`${open} === 'graph,map,notebook,signals'`, 1500)))
        reasons.push(`Esc did not restore the layout (open: ${await evaluate(cdp, open)})`);
      await click("#ws-win-signals .sig-back");
      if (!(await waitIn(`!location.hash.includes('inc=') && !document.querySelector('#ws-win-signals .feed-pane-card .math')`, 1500)))
        reasons.push("Back did not return to the list and clear inc=");
      // The tool rail: Rate opens the inspector with the slice sentence, Rate again closes it; the toolbar's
      // Tools button hides the rail and T shows it again.
      if (!(await waitIn(`!!document.querySelector('.ws-rail [data-tool="stats"]')`, 1500)))
        reasons.push("no tool rail with a Statistics entry");
      await click('.ws-rail [data-tool="stats"]');
      if (!(await waitIn(`!!document.querySelector('.ws-rail-menu [data-tool="rate"]')`, 1500)))
        reasons.push("Statistics opened no menu with Rate");
      await click('.ws-rail-menu [data-tool="rate"]');
      if (
        !(await waitIn(
          `!!document.querySelector('#ws-inspector:not([hidden]) .tl-inspect[data-tool="rate"] .tl-sentence')?.textContent`,
          1500,
        ))
      )
        reasons.push("the Rate tool opened no inspector with the slice sentence");
      await key("Escape");
      if (!(await waitIn(`document.querySelector('#ws-inspector').hidden`, 1500))) reasons.push("Escape did not close the inspector");
      await click(".ws-tool-open");
      if (!(await waitIn(`!!document.querySelector('.ws-dock[hidden]')`, 1500))) reasons.push("the Tools button did not hide the rail");
      await key("t");
      if (!(await waitIn(`!!document.querySelector('.ws-dock:not([hidden])')`, 1500))) reasons.push("T did not show the rail again");
      await idle();
    },
    { name: "desktop-900", width: 1440, height: 900, mobile: false },
  );

  // The notebook: its window is open by default, "+" adds a Note, what is typed is saved and survives a reload.
  await interaction(
    "research-notebook",
    async (idle, reasons) => {
      await cleanWorkspace(idle);
      await evaluate(cdp, `localStorage.removeItem('aei.research.notebook')`);
      await load(cdp, urlOf("research"), idle);
      if (!(await waitIn(`!!document.querySelector('#ws-win-notebook .nb')`, 5000))) {
        reasons.push("the Notebook window is not open by default");
        return;
      }
      await evaluate(cdp, `document.querySelector('#ws-win-notebook .nb-plus').scrollIntoView({ block: 'center' })`);
      await click("#ws-win-notebook .nb-plus");
      if (!(await waitIn(`!!document.querySelector('#ws-win-notebook [role=menu] [data-add="note"]')`, 1500))) {
        reasons.push('"+" opened no menu with a Note');
        return;
      }
      await click('#ws-win-notebook [data-add="note"]');
      if (!(await waitIn(`document.activeElement?.classList.contains('nb-note-edit')`, 1500))) {
        reasons.push("a new Note did not open its editor");
        return;
      }
      const text = "Smoke note: two frames, slice 1 against slice 2";
      await cdp.send("Input.insertText", { text });
      if (!(await waitIn(`(localStorage.getItem('aei.research.notebook') ?? '').includes(${JSON.stringify(text)})`, 1500)))
        reasons.push("the typed note was not saved");
      await cdp.send("Page.navigate", { url: "about:blank" });
      await load(cdp, urlOf("research"), idle);
      if (
        !(await waitIn(
          `[...document.querySelectorAll('#ws-win-notebook .nb-cell[data-kind="note"] .nb-note')].some(n => n.textContent.includes(${JSON.stringify(text)}))`,
          5000,
        ))
      )
        reasons.push("the note did not survive a reload");
      await idle();
    },
    { name: "desktop-900", width: 1440, height: 900, mobile: false },
  );

  const en = async (idle) => {
    await load(cdp, urlOf("settings"), idle);
    await evaluate(cdp, `localStorage.setItem('aei.lang', 'en'); localStorage.setItem('aei.audience', 'control'); true`);
  };
  // Home loads the project list after it paints; wait for it, or a click can land on a card that moved in.
  const goHome = async () => {
    await click(".sb-home");
    if (
      !(await waitIn(
        `!!document.querySelector('.start-project-grid, .start-empty') && !document.querySelector('.start-page [aria-busy=true]')`,
      ))
    )
      throw new Error("Home did not load its projects");
    await sleep(200);
  };
  const projectOf = () => evaluate(cdp, `new URLSearchParams(location.hash.split('?')[1]).get('project')`);
  const removeProject = async (id, idle) => {
    if (!id) return;
    // Leave the project first: deleting it under an open page makes its next layout save a 404.
    await load(cdp, urlOf("home"), idle);
    await fetch(`${base}/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  };

  await interaction("start", async (idle, reasons) => {
    await en(idle);
    await cdp.send("Page.navigate", { url: "about:blank" });
    await load(cdp, urlOf("start"), idle);
    if (
      !(await waitIn(
        `(!!document.querySelector('.start-empty') || !!document.querySelector('.start-project-grid')) && document.querySelectorAll('[data-template]').length === 5`,
      ))
    )
      reasons.push("start page did not show recent projects (or its empty state) and five templates");
    await click('.start-audience input[value="clinician"] + span');
    if (
      !(await waitIn(
        `document.querySelector('[data-template]')?.dataset.template === 'patient' && document.documentElement.dataset.density === 'comfortable'`,
      ))
    )
      reasons.push("clinician preset did not promote treatment");
    await click('.start-audience input[value="researcher"] + span');
    if (
      !(await waitIn(
        `document.querySelector('[data-template]')?.dataset.template === 'blank' && document.documentElement.dataset.density === 'compact'`,
      ))
    )
      reasons.push("researcher preset did not promote blank");
    await click('.start-audience input[value="control"] + span');
    // The details form is the optional path: "+ New project" asks first, then the template is picked there.
    await click("[data-start-new]");
    await click('.start-template-choice input[value="outbreak"]');
    if (!(await waitIn(`!!document.querySelector('.start-create')`))) throw new Error("customise dialog missing");
    await screenshot(cdp, join(outDir, "start-create.png"));
    await click('.start-create button[type="submit"]');
    if (
      !(await waitIn(
        `location.hash.startsWith('#project?') && !!document.querySelector('#ws-win-signals') && !!document.querySelector('#ws-win-graph') && !document.querySelector('.project-dialog')`,
        15_000,
      ))
    )
      throw new Error("customised outbreak did not open with signals");
    const id = await projectOf();
    try {
      if (!(await waitIn(`!!document.querySelector('.sb-tab[data-tab="p:${id}"][data-current]')`)))
        reasons.push("the opened project has no current entry in the sidebar");
      const browserLayout = await evaluate(cdp, `localStorage.getItem('aei.research.layout.v2')`);
      await click("#ws-win-graph .ws-close");
      if (!(await waitIn(`fetch('/api/projects/${encodeURIComponent(id)}').then(r=>r.json()).then(r=>!!r.project.layout.closed.graph)`)))
        reasons.push("project layout change was not saved");
      if (await evaluate(cdp, `localStorage.getItem('aei.research.layout.v2') !== ${JSON.stringify(browserLayout)}`))
        reasons.push("project layout overwrote browser workspace");
      await goHome();
      const card = `[data-project-card="${id}"]`;
      if (!(await waitIn(`!!document.querySelector(${JSON.stringify(card)})`))) throw new Error("recent project card missing");
      await click(`${card} .start-card-open`);
      if (!(await waitIn(`!!document.querySelector('#ws-win-signals') && !document.querySelector('#ws-win-graph')`)))
        reasons.push("reopened project did not restore its saved layout");
      if ((await evaluate(cdp, `document.querySelectorAll('.sb-tab[data-tab="p:${id}"]').length`)) !== 1)
        reasons.push("reopening an open project made a second sidebar entry");
      await goHome();
      if (!(await waitIn(`!!document.querySelector(${JSON.stringify(card)})`))) throw new Error("recent project card missing on return");
      await screenshot(cdp, join(outDir, "start-recent-desktop.png"));
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await screenshot(cdp, join(outDir, "start-recent-phone.png"));
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: VIEWPORTS[0].width,
        height: VIEWPORTS[0].height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await click(`${card} summary`);
      await click(`${card} .start-card-menu button:nth-child(2)`);
      if (
        !(await waitIn(
          `document.querySelector('.share-preview')?.textContent.includes('Preview: sharing is not connected yet; nothing is sent.')`,
        ))
      )
        reasons.push("sharing mock note missing");
      await screenshot(cdp, join(outDir, "start-share.png"));
      await click(".project-dialog header button");
      await click(`${card} .start-card-menu button:nth-child(4)`);
      await click(".project-dialog [data-confirm-delete]");
      if (
        !(await waitIn(
          `!document.querySelector(${JSON.stringify(card)}) && !document.querySelector('.project-dialog') && !document.querySelector('[data-tab="p:${id}"]')`,
        ))
      )
        reasons.push("project was not deleted, or its sidebar entry stayed");
    } finally {
      await removeProject(id, idle);
    }
  });

  // A template opens straight into its own project (D-065): no dialog, a numbered name, continuous data.
  await interaction("template-launch", async (idle, reasons) => {
    await en(idle);
    await load(cdp, urlOf("home"), idle);
    const before = (await pageApi("/api/projects")).projects.length;
    const created = [];
    try {
      const launch = async () => {
        await waitIn(`!!document.querySelector('[data-template="outbreak"]:not(:disabled)')`);
        const previous = await projectOf();
        await click('[data-template="outbreak"]');
        const ok = await waitIn(
          `(() => { const id = new URLSearchParams(location.hash.split('?')[1]).get('project'); return location.hash.startsWith('#project?') && !!id && id !== ${JSON.stringify(previous)} && !!document.querySelector('#ws-win-signals') && !!document.querySelector('#ws-win-timeline') && !!document.querySelector('#ws-win-graph'); })()`,
          15_000,
        );
        if (!ok)
          throw new Error(
            `outbreak template did not open its project with signals, timeline and graph (${await evaluate(cdp, "location.hash")})`,
          );
        const id = await projectOf();
        created.push(id);
        return id;
      };
      const first = await launch();
      if (await evaluate(cdp, `!!document.querySelector('.project-dialog')`)) reasons.push("launching a template asked for details");
      const project = (await pageApi(`/api/projects/${encodeURIComponent(first)}`)).project;
      if (!/^Outbreak investigation \d+$/.test(project.name))
        reasons.push(`launched project is not named like "Outbreak investigation 1": ${project.name}`);
      if (project.mode !== "continuous") reasons.push("launched project is not continuous");
      const shown = await evaluate(
        cdp,
        `document.querySelector('.viewbar-title')?.textContent + ' | ' + document.querySelector('.sb-tab[data-current] .sb-tab-name')?.textContent`,
      );
      if (shown !== `${project.name} | ${project.name}`) reasons.push(`project name not shown in the view and sidebar: ${shown}`);
      await screenshot(cdp, join(outDir, "template-launched-desktop.png"));
      await goHome();
      const second = await launch();
      const again = (await pageApi(`/api/projects/${encodeURIComponent(second)}`)).project;
      if (again.name === project.name) reasons.push(`a second launch reused the name ${again.name}`);
      if ((await evaluate(cdp, `document.querySelectorAll('.sb-tab').length`)) < 2)
        reasons.push("two launched projects do not both show in the sidebar");
      // Switch back by the sidebar, then close the current one: its neighbour opens.
      await click(`.sb-tab[data-tab="p:${first}"] .sb-item`);
      if (!(await waitIn(`new URLSearchParams(location.hash.split('?')[1]).get('project') === ${JSON.stringify(first)}`)))
        reasons.push("choosing an open project in the sidebar did not switch to it");
      await click(`.sb-tab[data-tab="p:${first}"] .sb-tab-close`);
      if (
        !(await waitIn(
          `!document.querySelector('[data-tab="p:${first}"]') && new URLSearchParams(location.hash.split('?')[1]).get('project') === ${JSON.stringify(second)}`,
        ))
      )
        reasons.push("closing the current project did not show its neighbour");
      // Treat a patient is a quick start: a view without a project.
      await goHome();
      await click('[data-template="patient"]');
      if (
        !(await waitIn(
          `location.hash.startsWith('#project') && new URLSearchParams(location.hash.split('?')[1]).get('quick') === 'patient' && !new URLSearchParams(location.hash.split('?')[1]).has('project') && !!document.querySelector('#ws-win-coverage') && !!document.querySelector('.ws-area[data-maximized=true]') && !!document.querySelector('.sb-tab[data-tab="view"][data-current]')`,
          15_000,
        ))
      )
        reasons.push(
          `Treat a patient did not open the coverage list maximised in a project-less view: ${await evaluate(cdp, `location.hash + " | " + [...document.querySelectorAll(".sb-tab")].map(t => t.dataset.tab + (t.dataset.current ? "*" : "")).join() + " | " + [...document.querySelectorAll(".ws-win")].map(w => w.dataset.win).join()`)}`,
        );
      if ((await pageApi("/api/projects")).projects.length !== before + 2) reasons.push("Treat a patient created a project");
      await screenshot(cdp, join(outDir, "template-patient-desktop.png"));
      // Old links still work.
      for (const [from, to] of [
        ["#doctor?unit=URO", "#project"],
        ["#workspace?unit=URO", "#project"],
        ["#research?panel=grid", "#project"],
      ]) {
        await load(cdp, `${base}/${from}`, idle);
        if (!(await waitIn(`location.hash.split('?')[0] === ${JSON.stringify(to)}`)))
          reasons.push(`${from} did not land on ${to}: ${await evaluate(cdp, "location.hash")}`);
      }
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await load(cdp, `${base}/#project?project=${encodeURIComponent(second)}`, idle);
      await waitIn(`!!document.querySelector('#ws-win-timeline')`);
      await screenshot(cdp, join(outDir, "template-launched-phone.png"));
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: VIEWPORTS[0].width,
        height: VIEWPORTS[0].height,
        deviceScaleFactor: 1,
        mobile: false,
      });
    } finally {
      await load(cdp, urlOf("home"), idle);
      for (const id of created) await fetch(`${base}/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  });

  // The replay timeline is a window (D-066); the clock above the project steps it and every other window.
  await interaction("timeline-window", async (idle, reasons) => {
    await en(idle);
    await cleanWorkspace(idle);
    const win = "#ws-win-timeline";
    if (!(await waitIn(`!!document.querySelector('${win} .timeline-window .hs-svg')`, 15_000))) {
      reasons.push("the default view has no timeline window with its band");
      return;
    }
    const readout = `document.querySelector('${win} .tl-readout')?.textContent ?? ''`;
    const clockDate = `document.querySelector('.viewbar .clock-readout')?.textContent ?? ''`;
    const before = await evaluate(cdp, readout);
    if (!before || before === "–") reasons.push("timeline window shows no as-of date");
    if (!(await evaluate(cdp, `!!document.querySelector('${win} .tl-quality')?.textContent.trim()`)))
      reasons.push("timeline window has no data-quality status");
    if (!(await evaluate(cdp, `document.querySelectorAll('${win} .hs-svg text').length > 3`)))
      reasons.push("timeline band has no unit lanes");
    // Step one day from the clock: the clock and the window move together.
    const clockBefore = await evaluate(cdp, clockDate);
    await click('.viewbar .clock [data-step="1"]');
    if (
      !(await waitIn(
        `(${readout}) !== ${JSON.stringify(before)} && (${clockDate}) !== ${JSON.stringify(clockBefore)} && !document.querySelector('.clock[aria-busy]')`,
        15_000,
      ))
    )
      reasons.push(`clock step did not move the timeline window (still ${await evaluate(cdp, readout)})`);
    // A demo jump from the window seeks the shared clock.
    await click(`${win} .tl-events-btn`);
    await click(`${win} .tl-event`);
    if (
      !(await waitIn(
        `(${readout}).includes('12.5.2025') || (${readout}).includes('2025-05-12') || (${clockDate}).includes('12 May 2025')`,
        15_000,
      ))
    )
      reasons.push(`demo jump did not seek the clock: ${await evaluate(cdp, readout)} / ${await evaluate(cdp, clockDate)}`);
    // The clock's menu: speed choices and a date jump, with Escape back to the date button.
    await click(".viewbar .clock-date");
    if (
      !(await waitIn(
        `document.querySelectorAll('.clock-pop [role=menuitemradio]').length === 4 && !!document.querySelector('.clock-pop input[type=date]')`,
      ))
    )
      reasons.push("clock menu has no speeds or date jump");
    await screenshot(cdp, join(outDir, "timeline-clock-menu.png"));
    await key("Escape");
    if (!(await waitIn(`!document.querySelector('.clock-pop') && document.activeElement?.classList.contains('clock-date')`)))
      reasons.push("Escape did not close the clock menu back to its button");
    await screenshot(cdp, join(outDir, "timeline-window-desktop.png"));
    // Close it and bring it back from Windows.
    await click(`${win} .ws-close`);
    if (!(await waitIn(`!document.querySelector('${win}')`))) reasons.push("timeline window did not close");
    await click("#ws-tray-button");
    await click('[data-reopen="timeline"]');
    if (!(await waitIn(`!!document.querySelector('${win} .hs-svg')`))) reasons.push("timeline window did not reopen from Windows");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(cdp, `document.querySelector('${win}')?.scrollIntoView({ block: 'start' })`);
    await idle();
    if (!(await evaluate(cdp, `!!document.querySelector('.phonebar .clock') && document.documentElement.scrollWidth <= innerWidth + 1`)))
      reasons.push("phone: no clock in the bar, or the page overflows");
    await screenshot(cdp, join(outDir, "timeline-window-phone.png"));
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORTS[0].width,
      height: VIEWPORTS[0].height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  });

  await interaction("projects", async (idle, reasons) => {
    // Use English labels so this check is independent of earlier language interactions.
    await load(cdp, urlOf("settings"), idle);
    await click(".settings button[lang='en']");
    if (!(await waitIn(`document.documentElement.lang === 'en'`))) throw new Error("English did not load");
    await cleanWorkspace(idle);
    const clock = await pageApi("/api/clock");
    const listed = `!!document.querySelector('.project-list[aria-busy=false]')`;
    const smokeRow = `[...document.querySelectorAll('.project-list li')].find(li => li.querySelector('strong')?.textContent === 'Smoke project')`;
    const menu = async (item) => {
      await click("#pm-project");
      if (!(await waitIn(`!!document.querySelector('[data-pm="${item}"]')`))) throw new Error(`Project menu has no ${item}`);
      await click(`[data-pm="${item}"]`);
    };
    // Keyboard: the Project menu opens on Enter at its first item; arrows move; Escape returns to the row.
    await evaluate(cdp, `document.querySelector('#pm-project').focus()`);
    await key("Enter");
    if (!(await waitIn(`document.activeElement?.dataset.pm === 'new'`)))
      reasons.push("Enter did not open the Project menu at its first item");
    await key("ArrowDown");
    if (!(await waitIn(`document.activeElement?.dataset.pm === 'new-custom'`))) reasons.push("ArrowDown did not move in the Project menu");
    await key("Escape");
    if (!(await waitIn(`document.activeElement?.id === 'pm-project' && !document.querySelector('[data-pm]')`)))
      reasons.push("Escape did not close the Project menu back to its row");
    await menu("open");
    if (!(await waitIn(listed))) throw new Error("Open dialog did not list projects (or its empty state)");
    if (!(await evaluate(cdp, `!!document.querySelector('.project-list ul, .project-list p')`)))
      reasons.push("Open dialog has neither projects nor an empty state");
    await click(".project-dialog header button");
    await menu("save");
    await click('.project-dialog form input[maxlength="200"]');
    await key("a", 2);
    await cdp.send("Input.insertText", { text: "Smoke project" });
    await click('.project-dialog input[value="frozen"]');
    if ((await evaluate(cdp, `document.querySelector('.project-dialog input[type=date]')?.value`)) !== clock.asOf)
      reasons.push("frozen as-of date did not default to the replay clock");
    await click('.project-dialog button[type="submit"]');
    if (
      !(await waitIn(
        `!document.querySelector('.project-dialog') && new URLSearchParams(location.hash.split('?')[1]).has('project') && !!document.querySelector('.viewbar .project-frozen')`,
      ))
    )
      throw new Error("saving a frozen project did not open it with project=<id> in the hash");
    const id = await projectOf();
    if (await evaluate(cdp, `!!document.querySelector('.sb-tab[data-tab="view"]')`))
      reasons.push("the saved view stayed open beside its project");
    if (!(await waitIn(`!!document.querySelector('.sb-tab[data-tab="p:${id}"] [data-frozen]')`)))
      reasons.push("the frozen project has no frozen marker in the sidebar");
    try {
      await menu("open");
      if (!(await waitIn(`${listed} && !!(${smokeRow})`))) throw new Error("saved project missing from the list");
      if (!(await evaluate(cdp, `(${smokeRow}).querySelector('.project-mode')?.textContent.includes('Frozen')`)))
        reasons.push("saved project has no frozen badge");
      await click(".project-dialog header button");
      const origin = await evaluate(cdp, `performance.timeOrigin`);
      await cdp.send("Page.reload");
      if (
        !(await waitIn(
          `performance.timeOrigin !== ${origin} && document.querySelector('.viewbar .project-frozen')?.textContent.includes('Frozen at ${clock.asOf}') && new URLSearchParams(location.hash.split('?')[1]).get('project') === ${JSON.stringify(id)}`,
        ))
      )
        throw new Error("reloading did not keep the frozen project open");
      await idle();
      const project = await pageApi(`/api/projects/${encodeURIComponent(id)}`);
      const downloadDir = mkdtempSync(join(tmpdir(), "aei-smoke-downloads-"));
      const downloads = new Map();
      const progress = (m) => {
        if (m.method === "Browser.downloadWillBegin") downloads.set(m.params.guid, { ...m.params, state: "inProgress" });
        if (m.method === "Browser.downloadProgress" && downloads.has(m.params.guid)) Object.assign(downloads.get(m.params.guid), m.params);
      };
      browser.on(progress);
      try {
        await browser.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir, eventsEnabled: true });
        await click("#pm-export");
        const download = async (label, extension) => {
          if (
            !(await waitIn(
              `!![...document.querySelectorAll('.project-export-options button')].find(b => b.textContent === ${JSON.stringify(label)} && !b.disabled)`,
            ))
          )
            throw new Error(`export control unavailable: ${label}`);
          const previous = new Set(downloads.keys());
          await evaluate(
            cdp,
            `[...document.querySelectorAll('.project-export-options button')].find(b => b.textContent === ${JSON.stringify(label)}).click()`,
          );
          const until = Date.now() + 30_000;
          while (Date.now() < until) {
            const fresh = [...downloads.values()].filter((d) => !previous.has(d.guid));
            if (fresh.some((d) => d.state === "canceled")) throw new Error(`${label} download canceled`);
            const done = await evaluate(cdp, `document.querySelector('.project-export-options')?.getAttribute('aria-busy') === 'false'`);
            if (fresh.length && done && fresh.every((d) => d.state === "completed")) {
              const files = fresh.filter((d) => d.suggestedFilename.endsWith(extension));
              if (!files.length) throw new Error(`${label} downloaded no ${extension} file`);
              return files.map((d) => readFileSync(join(downloadDir, d.suggestedFilename)));
            }
            if (await evaluate(cdp, `!!document.querySelector('.project-error[role=alert]')`))
              throw new Error(`${label} export reported an error`);
            await sleep(100);
          }
          throw new Error(`${label} download did not complete in 30 s`);
        };
        const [json] = await download("JSON", ".json");
        const bundle = JSON.parse(json.toString("utf8"));
        if (bundle.format !== "aei-export/1") reasons.push("JSON export has the wrong format");
        if (!bundle.tables?.find((table) => table.name === "isolates")?.rows.length) reasons.push("JSON export has no isolates");
        if (!project.project.fingerprint?.sha256 || JSON.stringify(bundle.fingerprint) !== JSON.stringify(project.project.fingerprint))
          reasons.push("JSON export does not carry the project's fingerprint");
        const [word] = await download("Word (.docx)", ".docx");
        if (word.subarray(0, 2).toString() !== "PK") reasons.push("Word export is not a ZIP (.docx)");
        for (const svg of await download("Figures (SVG)", ".svg")) {
          const text = svg.toString("utf8");
          if (!text.startsWith("<svg") || text.includes("var(--")) reasons.push("SVG export is not standalone with inlined styles");
        }
      } finally {
        browser.off(progress);
        await browser.send("Browser.setDownloadBehavior", { behavior: "default", eventsEnabled: false });
        rmSync(downloadDir, { recursive: true, force: true });
      }
      await key("Escape");
      await menu("delete");
      await click(".project-dialog [data-confirm-delete]");
      if (
        !(await waitIn(
          `!document.querySelector('.project-dialog') && !new URLSearchParams(location.hash.split('?')[1]).has('project') && !document.querySelector('[data-tab="p:${id}"]')`,
        ))
      )
        reasons.push("deleted project remains open or in the sidebar");
      if ((await fetch(`${base}/api/projects/${encodeURIComponent(id)}`)).status !== 404)
        reasons.push("deleted project still on the server");
      await idle();
    } finally {
      await removeProject(id, idle);
    }
  });

  await interaction("reproduce", async (idle, reasons) => {
    await load(cdp, urlOf("settings"), idle);
    await click(".settings button[lang='en']");
    await cleanWorkspace(idle);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `addEventListener("unhandledrejection", e => { console.error(String(e.reason?.stack ?? e.reason)); });`,
    });
    await click("#pm-project");
    await click('[data-pm="save"]');
    if (!(await waitIn(`!!document.querySelector('.project-dialog form')`))) throw new Error("Save as project dialog did not open");
    await click('.project-dialog form input[maxlength="200"]');
    await cdp.send("Input.insertText", { text: "Smoke reproduce" });
    await click('.project-dialog input[value="frozen"]');
    await click('.project-dialog button[type="submit"]');
    if (!(await waitIn(`!!document.querySelector('[data-open-reproduce]:not(:disabled)') && !document.querySelector('.project-dialog')`)))
      throw new Error("Frozen project did not open");
    const id = await evaluate(cdp, `new URLSearchParams(location.hash.split('?')[1]).get('project')`);
    try {
      await click("[data-open-reproduce]");
      if (!(await waitIn(`!!document.querySelector('#ws-win-reproduce')`))) throw new Error("Reproduce window did not open");
      // Give the editor the whole board while the browser kernel loads.
      await click("#ws-win-reproduce .ws-maximize");
      const frame = `document.querySelector('.reproduce-frame')`;
      const doc = `${frame}?.contentDocument`;
      const win = `${frame}?.contentWindow`;
      if (!(await waitIn(`!!${doc}?.querySelector('.jp-Notebook')`, 120_000))) {
        throw new Error(`JupyterLab notebook did not load in 120 s: ${await evaluate(cdp, `${doc}?.body?.innerText?.slice(-1800)`)}`);
      }
      const notebookClick = async (selector, label) => {
        const point = await evaluate(
          cdp,
          `(() => {
          const f = ${frame}, d = f.contentDocument;
          const el = [...d.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim().includes(${JSON.stringify(label)}));
          if (!el) throw new Error('JupyterLab control missing: ' + ${JSON.stringify(label)});
          const r = el.getBoundingClientRect(), origin = f.getBoundingClientRect();
          return { x: origin.left + r.left + r.width / 2, y: origin.top + r.top + r.height / 2 };
        })()`,
        );
        await mouse("mousePressed", point, { button: "left", buttons: 1, clickCount: 1 });
        await mouse("mouseReleased", point, { button: "left", buttons: 0, clickCount: 1 });
      };
      const kernelIdle = `(() => {
        const app = ${win}?.jupyterapp;
        if (app?.shell?.currentWidget?.sessionContext) return app.shell.currentWidget.sessionContext.session?.kernel?.status === 'idle';
        const d = ${doc};
        return [...(d?.querySelectorAll('[title], [data-status]') ?? [])].some(e => /kernel.*idle|idle.*kernel/i.test(e.title) || e.dataset.status === 'idle') || /Python.*Idle|Idle.*Python/s.test(d?.querySelector('.jp-StatusBar')?.textContent ?? '');
      })()`;
      if (!(await waitIn(kernelIdle, 120_000)))
        throw new Error(`Python kernel not idle in 120 s: ${await evaluate(cdp, `${doc}?.body?.innerText?.slice(-1800)`)}`);
      const command = await evaluate(
        cdp,
        `(() => { const app = ${win}?.jupyterapp; if (!app?.commands) return false; void app.commands.execute('notebook:run-all-cells'); return true; })()`,
      );
      if (!command) {
        await notebookClick(".lm-MenuBar-item", "Run");
        if (!(await waitIn(`[...(${doc}?.querySelectorAll('.lm-Menu-item') ?? [])].some(e => /Run All Cells/.test(e.textContent))`)))
          throw new Error(`JupyterLab Run All Cells menu missing: ${await evaluate(cdp, `${doc}?.body?.innerText?.slice(-1800)`)}`);
        await notebookClick(".lm-Menu-item", "Run All Cells");
      }
      const outputs = `[...(${doc}?.querySelectorAll('.jp-OutputArea-output') ?? [])].map(e => e.textContent).join('\\n')`;
      if (!(await waitIn(`(${outputs}).includes('✓') && !!${doc}?.querySelector('.jp-OutputArea-output table') && ${kernelIdle}`, 120_000)))
        reasons.push(
          `Notebook verify/table did not complete: ${await evaluate(cdp, outputs)} | ${await evaluate(cdp, `${doc}?.body?.innerText?.slice(-2000)`)}`,
        );
      if (await evaluate(cdp, `[...(${doc}?.querySelectorAll('.jp-Dialog') ?? [])].some(e => /Select Kernel/.test(e.textContent))`))
        reasons.push("JupyterLite asked the researcher to select a kernel instead of starting Python");
      const result = await evaluate(
        cdp,
        `(() => {
        const cells = [...${doc}.querySelectorAll('.jp-CodeCell')];
        const verify = cells.find(c => /aei\\.verify|project\\.verify|pkg\\.verify/.test(c.querySelector('.jp-InputArea')?.textContent ?? ''));
        const reproduce = cells.find(c => /\\.reproduce\\(/.test(c.querySelector('.jp-InputArea')?.textContent ?? ''));
        return { verify: verify?.querySelector('.jp-OutputArea')?.textContent ?? '', table: reproduce?.querySelector('.jp-OutputArea table')?.textContent ?? '', errors: [...${doc}.querySelectorAll('.jp-OutputArea-output[data-mime-type="application/vnd.jupyter.stderr"]')].map(e => e.textContent) };
      })()`,
      );
      if (!result.verify.includes("✓")) reasons.push(`Verify cell has no checkmark: ${result.verify}`);
      if (!result.table || /\bFalse\b/.test(result.table)) reasons.push(`Reproduce table missing or contains False: ${result.table}`);
      if (result.errors.length) reasons.push(`Notebook errors: ${result.errors.join("; ")}`);
      await evaluate(cdp, `window.__reproduceFrame = ${frame}; ${frame}.contentWindow.__reproduceSmoke = 'alive'`);
      await click("#ws-win-reproduce .ws-maximize");
      const source = await pointOf("#ws-title-reproduce"),
        target = await pointOf("#ws-title-signals");
      await mouse("mousePressed", source, { button: "left", buttons: 1, clickCount: 1 });
      await mouse("mouseMoved", target, { buttons: 1 });
      if (await evaluate(cdp, `getComputedStyle(${frame}).pointerEvents !== 'none'`)) reasons.push("Iframe swallows workspace drag");
      await mouse("mouseReleased", target, { button: "left", buttons: 0, clickCount: 1 });
      if (!(await waitIn(`!!document.querySelector('#ws-win-reproduce')?.closest('.ws-column')?.querySelector('#ws-win-signals')`)))
        reasons.push("Reproduce did not move to the signals column");
      const preserved = `${frame} === window.__reproduceFrame && ${win}.__reproduceSmoke === 'alive'`;
      if (!(await evaluate(cdp, preserved))) reasons.push("Moving Reproduce reloaded its iframe/kernel");
      await click("#ws-win-reproduce .ws-close");
      if (!(await waitIn(`getComputedStyle(${frame}).visibility === 'hidden'`))) reasons.push("Closed notebook iframe remains visible");
      await click("#ws-tray-button");
      await click('[data-reopen="reproduce"]');
      await key("Escape");
      if (!(await evaluate(cdp, preserved))) reasons.push("Reopening Reproduce reloaded its iframe/kernel");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      if (!(await waitIn(`document.querySelector('.ws')?.dataset.docked === 'false'`))) reasons.push("Phone layout did not activate");
      if (!(await evaluate(cdp, preserved))) reasons.push("Phone layout reloaded notebook iframe/kernel");
      await evaluate(cdp, `document.querySelector('#ws-win-reproduce').scrollIntoView({ block: 'start' })`);
      if (
        !(await waitIn(`(() => {
          const slot = document.querySelector('[data-reproduce-slot]').getBoundingClientRect(), frame = ${frame}.getBoundingClientRect();
          return Math.abs(slot.top - frame.top) < 2 && Math.abs(slot.left - frame.left) < 2;
        })()`))
      )
        reasons.push("Notebook overlay lost its phone slot after scrolling");
      await screenshot(cdp, join(outDir, "reproduce-phone.png"));
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: VIEWPORTS[0].width,
        height: VIEWPORTS[0].height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await click("#ws-win-reproduce .ws-maximize");
    } finally {
      // Leave the project first: deleting it under an open page makes its next layout save a 404.
      await load(cdp, urlOf("start"), idle);
      await fetch(`${base}/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  });

  await interaction("home-incident-period", async (idle, reasons) => {
    await load(cdp, urlOf("home"), idle);
    if (!(await waitIn(`!!document.querySelector(".hm-period select")`, 15_000))) {
      reasons.push("home summary has no period selector");
      return;
    }
    const headline = await evaluate(cdp, `document.querySelector(".hm-head :is(h1, h2)")?.textContent`);
    const keys = await evaluate(cdp, `JSON.stringify([...document.querySelectorAll(".hm-incidents .feed-row")].map(b => b.dataset.key))`);
    for (const days of [7, 28, 1]) {
      await evaluate(
        cdp,
        `(() => { const s = document.querySelector(".hm-period select"); s.value = "${days}"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      if (!(await waitIn(`document.querySelector(".hm-period select")?.value === "${days}"`)))
        reasons.push(`period ${days} did not select`);
      const stable = await evaluate(
        cdp,
        `document.querySelector(".hm-head :is(h1, h2)")?.textContent === ${JSON.stringify(headline)} && JSON.stringify([...document.querySelectorAll(".hm-incidents .feed-row")].map(b => b.dataset.key)) === ${JSON.stringify(keys)}`,
      );
      if (!stable) reasons.push(`changing new period to ${days} hid or changed open incidents`);
    }
    if (
      !(await evaluate(
        cdp,
        `document.querySelector(".hm-head :is(h1, h2)")?.textContent.includes(document.documentElement.lang === "fi" ? "Avoimet tapahtumat" : "Open incidents")`,
      ))
    )
      reasons.push("home headline does not name open incidents");
    await idle();
  });

  await interaction("research-signal-isolates", async (idle, reasons) => {
    await load(cdp, urlOf("research"), idle);
    if (!(await waitIn(`!!document.querySelector(".feed-row")`, 15_000))) {
      reasons.push("no signal in the research feed");
      return;
    }
    await evaluate(cdp, `document.querySelector(".feed-row").click()`);
    const shown = await waitIn(`document.querySelectorAll(".feed-iso-table tbody tr").length > 0`, 15_000);
    if (!shown) {
      const seen = await evaluate(
        cdp,
        `(document.querySelector(".math")?.innerText ?? "no signal panel").slice(0, 160).replace(/\\s+/g, " ")`,
      );
      reasons.push(`no isolates 15 s after opening a signal (${seen})`);
    }
    if (
      !(await evaluate(
        cdp,
        `document.querySelector(".feed-row")?.textContent.includes(document.documentElement.lang === "fi" ? "Yksi tapahtuma" : "One incident")`,
      ))
    )
      reasons.push("incident summary does not distinguish the incident from its alerts");
    const explain = ".math .alert-explanation > button";
    // The explanation sits in the card's "In plain words" fold; open it as a reader would.
    await evaluate(cdp, `document.querySelector(".math .sig-plain")?.setAttribute("open", "")`);
    const valid = await evaluate(
      cdp,
      `(() => { const b = document.querySelector(${JSON.stringify(explain)}); return b?.tagName === "BUTTON" && b.type === "button" && !!b.textContent.trim() && !!b.getAttribute("aria-controls"); })()`,
    );
    if (!valid) {
      reasons.push("explain control is not a named native button linked to its panel");
      return;
    }
    await evaluate(cdp, `document.querySelector(${JSON.stringify(explain)}).click()`);
    if (!(await waitIn(`!!document.querySelector(".math .alert-explanation [aria-live] p:not(.field-hint)")`, 15_000)))
      reasons.push("clicking explain did not load its template explanation");
    await evaluate(cdp, `document.querySelector(${JSON.stringify(explain)}).focus()`);
    // A keyDown needs its text, as a physical key gives, or Chrome raises no keypress and no click on the button.
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      text: "\r",
      unmodifiedText: "\r",
    });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    if (!(await waitIn(`document.querySelector(${JSON.stringify(explain)})?.getAttribute("aria-expanded") === "false"`)))
      reasons.push("Enter did not close the explanation");
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      text: " ",
      unmodifiedText: " ",
    });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    if (
      !(await waitIn(
        `document.querySelector(${JSON.stringify(explain)})?.getAttribute("aria-expanded") === "true" && !!document.querySelector(".math .alert-explanation [aria-live] p:not(.field-hint)")`,
        15_000,
      ))
    )
      reasons.push("Space did not reopen the template explanation");
    await idle();
  });

  await interaction("search", async (idle, reasons) => {
    await load(cdp, urlOf("home"), idle);
    // "/" is typed as a key press; the search field takes focus, then the letters go into it.
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", code: "Slash", text: "/" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/", code: "Slash" });
    if (!(await waitIn(`document.activeElement?.classList.contains("cmd-input")`))) reasons.push('"/" did not focus the search field');
    await cdp.send("Input.insertText", { text: "uro" });
    if (
      !(await waitIn(
        `document.querySelector(".cmd-input")?.value === "uro" && document.querySelectorAll(".cmd-list [role=option]").length > 0`,
      ))
    )
      reasons.push('typing "uro" in the search showed no result');
    await idle();
  });

  // Eight tabs at once in one browser: HTTP/1.1 allows six connections per host, so the app must share one
  // live stream across tabs (src/feed) or the seventh tab never loads.
  await interaction("eight-tabs", async (idle, reasons) => {
    await load(cdp, urlOf("research"), idle);
    const extra = [];
    try {
      for (let i = 0; i < 7; i++) {
        const p = await browser.newPage(VIEWPORTS[0]);
        extra.push(p);
        await p.send("Page.navigate", { url: urlOf(ROUTES[i % ROUTES.length]) });
      }
      const loaded = async (p) => {
        const until = Date.now() + 25_000;
        while (Date.now() < until) {
          const ok = await evaluate(p, READY).catch(() => false);
          if (ok) return true;
          await sleep(250);
        }
        return false;
      };
      const results = await Promise.all(extra.map(loaded));
      results.forEach((ok, i) => {
        if (!ok) reasons.push(`tab ${i + 2} of 8 (${ROUTES[i % ROUTES.length]}) did not finish loading in 25 s`);
      });
    } finally {
      for (const p of extra) await p.close();
    }
  });

  // Put the clock back where it was. Each browser has its own clock now (D-084), so this only matters for an app
  // that predates it; harmless otherwise.
  await fetch(`${base}/api/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "seek", date: clock0.asOf }),
  }).catch(() => {});
  browser.cleanup();

  // ---------- report ----------
  const failed = rows.filter((r) => !r.ok);
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  const md = [
    `# Smoke test`,
    "",
    `${base}, ${external ? "running app" : `data ${dataDir.replace(`${ROOT}/`, "")}`}, clock ${clock0.asOf}; ${rows.length - failed.length} of ${rows.length} passed in ${seconds} s.`,
    "",
    "| Check | Viewport | Result | Heading | Problems |",
    "|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.check} | ${r.viewport} | ${r.ok ? "pass" : "FAIL"} | ${r.heading.slice(0, 50)} | ${[...r.reasons, ...r.warnings.map((w) => `(warning) ${w}`)].join("<br>").replace(/\|/g, "\\|")} |`,
    ),
    "",
  ].join("\n");
  writeFileSync(join(outDir, "report.md"), md);
  writeFileSync(join(outDir, "report.json"), JSON.stringify({ base, asOf: clock0.asOf, rows }, null, 2));
  console.log(`\n${rows.length - failed.length}/${rows.length} passed in ${seconds} s; screenshots and report in ${outDir}`);
  if (failed.length) {
    console.log(`\nFailed:\n${failed.map((r) => `- ${r.check} (${r.viewport}): ${r.reasons.join("; ")}`).join("\n")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(`smoke: ${e.message ?? e}`);
    process.exitCode = 1;
  })
  .finally(() => {
    stopAll();
    setTimeout(() => process.exit(process.exitCode ?? 0), 300).unref();
  });
