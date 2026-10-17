// Smoke test: render every screen at desktop and phone size in a real Chrome and fail loudly on breakage.
// No dependencies beyond Node 22 and a Chrome or Chromium binary, driven over the DevTools protocol.
//
//   pnpm smoke                                   # starts API + web on the real dataset, clock 2025-06-10
//   pnpm smoke -- --fixture                      # the small committed fixture instead (what CI runs)
//   SMOKE_URL=http://localhost:5173 pnpm smoke   # test an app that is already running
//
// Options: --data DIR, --as-of YYYY-MM-DD, --api-port 8798, --web-port 5176, --out DIR (default
// apps/web/smoke-out), --routes home,doctor,... (home is the empty hash), --interactions all|doctor|name,..., --headed. Chrome comes from $CHROME, else google-chrome,
// google-chrome-stable, chromium or chromium-browser on the PATH.
//
// Per route and viewport it checks: no uncaught exception or console error, no /api request that failed or
// answered 400 or more, exactly one visible main heading (h1) with text, the header (header.topbar) and the
// tab bar (nav.sections) present, no horizontal page overflow, at least one visible control, and the page
// finished loading. The pitch intro (#intro) is full screen, so it is checked without the header and tabs.
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
const ROUTES = opt("routes", "home,doctor,research,method,settings,intro").split(",");
const INTERACTIONS = interactionGroup === "all" || interactionGroup === "doctor" ? [] : interactionGroup.split(",").filter(Boolean);
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];
const external = process.env.SMOKE_URL?.replace(/\/$/, "");
// A route name is its hash; home is the empty hash.
const hashOf = (route) => (route === "home" ? "" : `#${route}`);
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
  return { newPage, cleanup };
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
  const root = document.querySelector("main, .intro");
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
  const root = document.querySelector("main") ?? document.querySelector(".intro");
  const h1s = [...(root ? root.querySelectorAll("h1") : [])].filter(vis);
  const controls = [...(root ? root.querySelectorAll("button, a[href], input, select, [role=radio], [role=tab]") : [])].filter(vis);
  return {
    heading: h1s[0] ? h1s[0].textContent.trim().replace(/\\s+/g, " ") : "",
    headings: h1s.length,
    header: !!document.querySelector("header.topbar"),
    tabs: !!document.querySelector("nav.sections"),
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
      if (route !== "intro") {
        if (!info.header) extra.push("header.topbar missing");
        if (!info.tabs) extra.push("tab bar (nav.sections) missing");
      }
      if (info.busy) extra.push("still loading (aria-busy) after 25 s");
      if (info.overflow > 1) extra.push(`page ${info.overflow}px wider than the viewport`);
      if (info.controls === 0) extra.push("no visible control in the page");
      // A page may add its own params to the hash (#doctor?unit=MED-A); only the page part is compared.
      if (info.hash.split("?")[0] !== hashOf(route)) extra.push(`landed on ${info.hash || "(home)"}`);
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
          `(() => { const q = new URLSearchParams(location.hash.split('?')[1] ?? ''); q.set('site', 'blood'); q.set('sev', 'severe'); location.hash = 'doctor?' + q; return true; })()`,
        );
        if (
          !(await waitIn(
            `location.hash.includes('site=blood') && location.hash.includes('sev=severe') && !!document.querySelector('.cl[aria-busy=false] .cl-row')`,
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
          if (!(await evaluate(cdp, `location.hash.startsWith('#doctor') && !document.querySelector('.cmd[data-expanded]')`)))
            reasons.push("details tap opened navigation or search");
          await screenshot(cdp, join(outDir, `doctor-details-${vp.name}.png`));
        }
        await evaluate(
          cdp,
          `document.querySelector('.dp-close')?.click(); document.querySelector('.cl-disclosure .data-quality a')?.click()`,
        );
        if (!(await waitIn(`location.hash === '#settings?section=data' && !!document.querySelector('#settings-data .quality-results')`)))
          reasons.push("source line did not lead to loaded quality checks");
      },
      vp,
    );
  }

  const tabRoutes = ["doctor", "research", "method", "home"];
  await interaction("tabs", async (idle, reasons) => {
    await load(cdp, urlOf("home"), idle);
    for (const route of tabRoutes) {
      const label = route === "home" ? 0 : tabRoutes.indexOf(route) + 1;
      // The tabs are buttons in nav.sections, in the order home, doctor, research, method.
      const clicked = await evaluate(
        cdp,
        `(() => { const b = document.querySelectorAll("nav.sections button.section-tab")[${label}]; if (!b) return false; b.click(); return true; })()`,
      );
      if (!clicked) {
        reasons.push(`no tab for ${route}`);
        continue;
      }
      const ok = await waitIn(
        `location.hash.split("?")[0] === ${JSON.stringify(hashOf(route))} && document.querySelectorAll("nav.sections button.section-tab")[${label}]?.getAttribute("aria-current") === "page" && !!document.querySelector("main h1")?.textContent.trim()`,
        15_000,
      );
      if (!ok) {
        const seen = await evaluate(
          cdp,
          `location.hash + " | h1: " + (document.querySelector("main h1")?.textContent ?? "none") + " | main: " + (document.querySelector("main")?.innerText ?? "").slice(0, 120).replace(/\\s+/g, " ")`,
        );
        reasons.push(`tab ${route}: no heading 15 s after the click (${seen})`);
      }
      await idle();
    }
  });

  // The replay clock is shared by a running app; the run puts it back at the end (see "seek" below).
  await interaction("step-one-day", async (idle, reasons) => {
    await load(cdp, urlOf("home"), idle);
    const readout = `document.querySelector(".timeline .tl-readout")?.textContent ?? ""`;
    const before = await evaluate(cdp, readout);
    if (!before || before === "–") reasons.push("no as-of date in the timeline readout");
    const clicked = await evaluate(
      cdp,
      `(() => {
      const b = document.querySelector('.timeline .tl-steps button[data-stop="2"]');
      if (!b || b.disabled) return false; b.click(); return true; })()`,
    );
    if (!clicked) {
      reasons.push("no enabled step-one-day button in the timeline");
      return;
    }
    const changed = await waitIn(`(${readout}) !== ${JSON.stringify(before)} && !document.querySelector(".timeline[aria-busy]")`, 15_000);
    if (!changed) reasons.push(`as-of date still "${before}" 15 s after stepping one day`);
    await idle();
  });

  await interaction("language", async (idle, reasons) => {
    // The language is chosen only in Settings; the header has no switch.
    await load(cdp, urlOf("settings"), idle);
    if (await evaluate(cdp, `!!document.querySelector(".top-tools button[lang]")`)) reasons.push("a language button in the header");
    const before = await evaluate(cdp, `document.documentElement.lang`);
    const nav = await evaluate(cdp, `document.querySelector("nav.sections")?.textContent ?? ""`);
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
    if (!(await waitIn(`(document.querySelector("nav.sections")?.textContent ?? "") !== ${JSON.stringify(nav)}`)))
      reasons.push(`tab labels unchanged after choosing "${clicked}"`);
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
    await evaluate(cdp, `localStorage.removeItem('aei.research.layout.v2')`);
    await cdp.send("Page.navigate", { url: "about:blank" });
    await load(cdp, urlOf("research"), idle);
  };
  await interaction(
    "research-workspace-close",
    async (idle, reasons) => {
      await cleanWorkspace(idle);
      const columns = `document.querySelectorAll('.ws-column').length`;
      const empty = `[...document.querySelectorAll('.ws-column')].some(c => !c.querySelector('.ws-win'))`;
      for (const id of ["math", "map"]) {
        const before = await evaluate(cdp, columns);
        // In the fitted 1440x900 default, Alert math and Map are each alone in their column.
        const alone = await evaluate(
          cdp,
          `document.querySelector('#ws-win-${id}')?.closest('.ws-column')?.querySelectorAll('.ws-win').length === 1`,
        );
        if (!alone) reasons.push(`${id} is not alone in its column in the fitted default`);
        await click(`#ws-win-${id} .ws-close`);
        if (!(await waitIn(`!document.querySelector('#ws-win-${id}')`, 1000)))
          reasons.push(`${id} not dismissed by its first real close click`);
        // Closing a column's only window removes the column; the others take its width.
        if (alone && !(await waitIn(`${columns} === ${before - 1}`, 1000)))
          reasons.push(`closing ${id}, alone in its column, left ${await evaluate(cdp, columns)} columns (was ${before})`);
        if (await evaluate(cdp, empty)) reasons.push(`an empty column remains after closing ${id}`);
      }
      const fill = await evaluate(
        cdp,
        `(() => { const a = document.querySelector('.ws-area').getBoundingClientRect(); const c = [...document.querySelectorAll('.ws-column')];
          return Math.abs(c.reduce((s, e) => s + e.getBoundingClientRect().width, 0) + (c.length - 1) * 8 - a.width) < 4; })()`,
      );
      if (!fill) reasons.push("the remaining columns do not fill the board after closing");
    },
    { name: "desktop-900", width: 1440, height: 900, mobile: false },
  );

  await interaction(
    "research-workspace",
    async (idle, reasons) => {
      await cleanWorkspace(idle);
      const order = `JSON.stringify([...document.querySelectorAll('.ws-column')].map(c => [...c.querySelectorAll('.ws-win')].map(w => w.dataset.win)))`;
      const initial = await evaluate(cdp, order);
      const geometry = await evaluate(
        cdp,
        `(() => {
      const b = document.querySelector('.ws-area').getBoundingClientRect();
      const p = document.querySelector('.page');
      const svg = document.querySelector('.geo-svg').getBoundingClientRect();
      const body = document.querySelector('#ws-win-map .ws-body').getBoundingClientRect();
      return { bottom: b.bottom, height: b.height, overflow: p.scrollHeight - p.clientHeight,
        mapFits: svg.left >= body.left && svg.right <= body.right + 1 && svg.top >= body.top && svg.bottom <= body.bottom + 1 };
    })()`,
      );
      if (geometry.bottom > 900 || geometry.height < 200 || geometry.overflow > 1)
        reasons.push(`board does not fit viewport: ${JSON.stringify(geometry)}`);
      if (!geometry.mapFits) reasons.push("map SVG clipped in its default dock");
      // No open window is squashed to its header: each body keeps its minimum (the column scrolls instead).
      const squashed = `JSON.stringify([...document.querySelectorAll('.ws-win')].filter(w => w.getBoundingClientRect().width > 0)
        .map(w => ({ id: w.dataset.win, body: Math.round(w.querySelector('.ws-body').getBoundingClientRect().height), min: Number(w.dataset.minBody) }))
        .filter(w => w.body < w.min - 1))`;
      for (const width of [1440, 1920]) {
        await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await cdp.send("Page.navigate", { url: "about:blank" });
        await load(cdp, urlOf("research"), idle);
        const bad = await evaluate(cdp, squashed);
        if (bad !== "[]") reasons.push(`window bodies below their minimum at ${width}x900: ${bad}`);
        const many = await evaluate(
          cdp,
          `[...document.querySelectorAll('.ws-column')].some(c => c.querySelectorAll('.ws-win').length > 2)`,
        );
        if (many) reasons.push(`default layout stacks more than two windows in a column at ${width}x900`);
      }
      // The tray button says what its number is.
      const label = await evaluate(cdp, `document.querySelector('#ws-tray-button').textContent`);
      if (!/\d+ (closed|suljettuna)/.test(label)) reasons.push(`tray button does not name its closed count: ${label}`);
      // Reopen into the previous stack, maximize, then restore exactly.
      await click("#ws-win-math .ws-close");
      await click("#ws-tray-button");
      const listed = `(() => { const l = [...document.querySelectorAll('.ws-pop-list')]; return !!l[0]?.querySelector('[data-reopen="math"]') && !l[0].querySelector('input') && !!l[1]?.querySelector('input'); })()`;
      if (!(await evaluate(cdp, listed))) reasons.push("the tray does not list closed windows first, with an open button");
      await click('[data-reopen="math"]');
      if (!(await waitIn(`${order} === ${JSON.stringify(initial)}`))) reasons.push("reopen changed the stack order");
      await key("Escape");
      await click("#ws-win-math .ws-maximize");
      const max = await evaluate(
        cdp,
        `(() => {
      const w = document.querySelector('#ws-win-math').getBoundingClientRect(), a = document.querySelector('.ws-area').getBoundingClientRect();
      return Math.abs(w.width-a.width)<2 && Math.abs(w.height-a.height)<2 && [...document.querySelectorAll('.ws-win')].filter(e=>e.getBoundingClientRect().width>0).length === 1;
    })()`,
      );
      if (!max) reasons.push("maximize did not fill the board and hide the other windows");
      await click("#ws-win-math .ws-maximize");
      if ((await evaluate(cdp, order)) !== initial) reasons.push("restore changed dock order");
      // Preview must not rearrange any stack. Esc must leave both DOM and persisted layout unchanged.
      const before = await evaluate(cdp, `localStorage.getItem('aei.research.layout.v2')`);
      const source = await pointOf("#ws-title-math"),
        target = await pointOf("#ws-title-map");
      await mouse("mousePressed", source, { button: "left", buttons: 1, clickCount: 1 });
      await mouse("mouseMoved", { x: target.x, y: target.y + 20 }, { buttons: 1 });
      if (!(await waitIn(`!!document.querySelector('.ws-insert')`, 1000))) reasons.push("drag has no insertion indicator");
      if ((await evaluate(cdp, order)) !== initial) reasons.push("drag preview reshuffled the windows");
      await key("Escape");
      await mouse("mouseReleased", target, { button: "left", buttons: 0, clickCount: 1 });
      if ((await evaluate(cdp, `localStorage.getItem('aei.research.layout.v2')`)) !== before) reasons.push("Esc did not cancel the move");
      // Drop into the map column (its own emptied column is removed), then move left using only the keyboard.
      await mouse("mousePressed", source, { button: "left", buttons: 1, clickCount: 1 });
      await mouse("mouseMoved", target, { buttons: 1 });
      await mouse("mouseReleased", target, { button: "left", buttons: 0, clickCount: 1 });
      if (
        !(await waitIn(
          `document.querySelector('#ws-win-math')?.closest('.ws-column')?.querySelector('#ws-win-map') && document.querySelectorAll('.ws-column').length === 2`,
        ))
      )
        reasons.push("drop did not insert into target column");
      await evaluate(cdp, `document.querySelector('#ws-title-math').focus()`);
      await key("ArrowLeft", 1);
      if (!(await waitIn(`document.querySelector('#ws-win-math')?.closest('.ws-column')?.dataset.columnIndex === '0'`)))
        reasons.push("Alt + arrow did not move the window");
      // Focusable splitters change the fraction, reset equally on double click/Enter.
      await evaluate(cdp, `document.querySelector('.ws-splitter-col').focus()`);
      const width = await evaluate(cdp, `document.querySelector('.ws-splitter-col').getAttribute('aria-valuenow')`);
      await key("ArrowRight");
      if ((await evaluate(cdp, `document.querySelector('.ws-splitter-col').getAttribute('aria-valuenow')`)) === width)
        reasons.push("keyboard column resize did not update aria-valuenow");
      await click(".ws-splitter-col", 2);
      const equal = await evaluate(
        cdp,
        `(() => { const c = JSON.parse(localStorage.getItem('aei.research.layout.v2')).columns; return c.every(x=>Math.abs(x.width-1/c.length)<0.001); })()`,
      );
      if (!equal) reasons.push("double-click did not equalize columns");
      const divider = await pointOf(".ws-splitter-col");
      const leftEdge = await evaluate(cdp, `document.querySelector('.ws-area').getBoundingClientRect().left + 1`);
      await mouse("mousePressed", divider, { button: "left", buttons: 1, clickCount: 1 });
      await mouse("mouseMoved", { x: leftEdge, y: divider.y }, { buttons: 1 });
      await mouse("mouseReleased", { x: leftEdge, y: divider.y }, { button: "left", buttons: 0, clickCount: 1 });
      const clamped = await waitIn(
        `(() => {
        const a=document.querySelector('.ws-area').getBoundingClientRect();
        const expected=Math.max(240,(a.width-16)*0.18);
        return Math.abs(document.querySelector('.ws-column').getBoundingClientRect().width-expected)<2;
      })()`,
        1000,
      );
      if (!clamped) reasons.push("column pointer drag did not clamp at its minimum");
      // Signals over Alert math needs a tall board to fit; on a short one the column scrolls and the splitter rests.
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
      await waitIn(`document.querySelector('.ws-column').scrollHeight <= document.querySelector('.ws-column').clientHeight + 1`, 2000);
      const row = await pointOf(".ws-splitter-row");
      const stackBefore = await evaluate(cdp, `document.querySelector('.ws-splitter-row').getAttribute('aria-valuenow')`);
      await mouse("mousePressed", row, { button: "left", buttons: 1, clickCount: 1 });
      await mouse("mouseMoved", { x: row.x, y: row.y + 40 }, { buttons: 1 });
      await mouse("mouseReleased", { x: row.x, y: row.y + 40 }, { button: "left", buttons: 0, clickCount: 1 });
      if ((await evaluate(cdp, `document.querySelector('.ws-splitter-row').getAttribute('aria-valuenow')`)) === stackBefore)
        reasons.push("pointer stack resize did not change the fraction");
      await evaluate(cdp, `document.querySelector('.ws-splitter-row').focus()`);
      await key("ArrowDown");
      await key("Enter");
      const heights = await evaluate(cdp, `JSON.parse(localStorage.getItem('aei.research.layout.v2')).columns[0].windows.map(w=>w.size)`);
      if (heights.some((h) => Math.abs(h - 1 / heights.length) > 0.001)) reasons.push("Enter did not equalize stack heights");
      const floors = await evaluate(
        cdp,
        `[...document.querySelectorAll('.ws-column')][0].querySelectorAll('.ws-win').length === 2 && ${squashed} === "[]"`,
      );
      if (!floors) reasons.push("stack splitter let a window below its minimum");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      // Presets and reset must change visible geometry, and a fresh load must keep the new model.
      for (const p of ["map", "signals", "units"]) {
        await click("#ws-tray-button");
        await click(`[data-preset="${p}"]`);
        if ((await evaluate(cdp, order)) === initial) reasons.push(`preset ${p} made no visible change`);
      }
      await click("#ws-tray-button");
      await click(".ws-pop-reset");
      if ((await evaluate(cdp, order)) !== initial) reasons.push("reset did not visibly restore the default stack order");
      await cdp.send("Page.navigate", { url: "about:blank" });
      await load(cdp, urlOf("research"), idle);
      if ((await evaluate(cdp, order)) !== initial) reasons.push("layout was not persisted across reload");
      // Edge drop from a two-column preset creates a third column, never a free-floating window.
      await click("#ws-tray-button");
      await click('[data-preset="map"]');
      await click("#ws-tray-button");
      await click('[data-reopen="math"]');
      const start = await pointOf("#ws-title-math");
      const edge = await evaluate(
        cdp,
        `(() => { const r=document.querySelectorAll('.ws-column')[1].getBoundingClientRect(); return {x:r.left+2,y:r.top+40}; })()`,
      );
      await mouse("mousePressed", start, { button: "left", buttons: 1, clickCount: 1 });
      await mouse("mouseMoved", edge, { buttons: 1 });
      if (!(await waitIn(`!!document.querySelector('.ws-new-column')`, 1000))) reasons.push("edge drop has no new-column indicator");
      await mouse("mouseReleased", edge, { button: "left", buttons: 0, clickCount: 1 });
      if (!(await waitIn(`document.querySelectorAll('.ws-column').length === 3`)))
        reasons.push("edge drop did not create a third docked column");
      await click("#ws-tray-button");
      await click(".ws-pop-reset");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 768, deviceScaleFactor: 1, mobile: false });
      // The language is chosen only in Settings; switch there when an earlier interaction has not already.
      if ((await evaluate(cdp, "document.documentElement.lang")) !== "en") {
        await load(cdp, urlOf("settings"), idle);
        await click(".settings button[lang='en']");
        await waitIn(`document.documentElement.lang === "en"`);
        await load(cdp, urlOf("research"), idle);
      }
      const compact = await evaluate(
        cdp,
        `(() => {
        const a=document.querySelector('.ws-area').getBoundingClientRect();
        return a.bottom <= 768 && [...document.querySelectorAll('.ws-column')].every(c=>c.getBoundingClientRect().width>=239) && document.documentElement.scrollWidth<=1100;
      })()`,
      );
      if (!compact) reasons.push("compact desktop overflows or loses column minimums");
      await screenshot(cdp, join(outDir, "research-compact-en.png"));
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await idle();
    },
    { name: "desktop-900", width: 1440, height: 900, mobile: false },
  );

  await interaction("home-incident-period", async (idle, reasons) => {
    await load(cdp, urlOf("home"), idle);
    if (!(await waitIn(`!!document.querySelector(".hm-period select")`, 15_000))) {
      reasons.push("home summary has no period selector");
      return;
    }
    const headline = await evaluate(cdp, `document.querySelector(".hm-head h1")?.textContent`);
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
        `document.querySelector(".hm-head h1")?.textContent === ${JSON.stringify(headline)} && JSON.stringify([...document.querySelectorAll(".hm-incidents .feed-row")].map(b => b.dataset.key)) === ${JSON.stringify(keys)}`,
      );
      if (!stable) reasons.push(`changing new period to ${days} hid or changed open incidents`);
    }
    if (
      !(await evaluate(
        cdp,
        `document.querySelector(".hm-head h1")?.textContent.includes(document.documentElement.lang === "fi" ? "Avoimet tapahtumat" : "Open incidents")`,
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
    const shown = await waitIn(`document.querySelectorAll(".feed-isolates li").length > 0`, 15_000);
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

  // Put the clock back where it was, for a shared running app.
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
