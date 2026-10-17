// Smoke test: render every screen at desktop and phone size in a real Chrome and fail loudly on breakage.
// No dependencies beyond Node 22 and a Chrome or Chromium binary, driven over the DevTools protocol.
//
//   pnpm smoke                                   # starts API + web on the real dataset, clock 2025-06-10
//   pnpm smoke -- --fixture                      # the small committed fixture instead (what CI runs)
//   SMOKE_URL=http://localhost:5173 pnpm smoke   # test an app that is already running
//
// Options: --data DIR, --as-of YYYY-MM-DD, --api-port 8798, --web-port 5176, --out DIR (default
// apps/web/smoke-out), --routes treat,alerts,... , --headed. Chrome comes from $CHROME, else google-chrome,
// google-chrome-stable, chromium or chromium-browser on the PATH.
//
// Per route and viewport it checks: no uncaught exception or console error, no /api request that failed or
// answered 400 or more, a main heading (h1) with text, the header and tab bar present, no horizontal page
// overflow, at least one visible control, and the page finished loading. Interactions cover navigation,
// stepping the simulation, language switching, expanded data checks, the county jump, the previous Alerts
// visit and eight concurrent tabs. Writes a PNG per check and report.md / report.json to
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
const ROUTES = opt("routes", "treat,alerts,report,timeline,settings").split(",");
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];
const external = process.env.SMOKE_URL?.replace(/\/$/, "");
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
      // /api/regional answers 404 when no THL file is mounted (D-037): the app shows an empty state, so a warning.
      const optional = p.response.status === 404 && u.includes("/api/regional");
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

async function load(cdp, url, idle) {
  await cdp.send("Page.navigate", { url });
  // Ready when the app has stopped saying it is busy and the network is quiet.
  const until = Date.now() + 25_000;
  while (Date.now() < until) {
    const ready = await evaluate(
      cdp,
      `!!document.querySelector("main") && document.querySelector("main").getAttribute("aria-busy") !== "true"`,
    ).catch(() => false);
    if (ready) break;
    await sleep(150);
  }
  await idle();
  await sleep(400); // let charts and transitions settle before the picture
}

const CHECKS = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const h1 = document.querySelector("main h1");
  const controls = [...document.querySelectorAll("main button, main a[href], main input, main select, main [role=radio], main [role=tab]")].filter(vis);
  return {
    heading: h1 ? h1.textContent.trim().replace(/\\s+/g, " ") : "",
    header: !!document.querySelector("header") && !!document.querySelector(".app-brand"),
    tabs: !!document.querySelector("nav.app-tabs"),
    busy: document.querySelector("main")?.getAttribute("aria-busy") === "true",
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
      { AEI_FEED_URL: `http://localhost:${apiPort}` },
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
        await load(cdp, `${base}/#${route}`, idle);
        info = await evaluate(cdp, CHECKS);
        await screenshot(cdp, file);
      });
      await cdp.close();
      const extra = [];
      if (!info.heading) extra.push("no main heading (main h1)");
      if (!info.header) extra.push("header or brand missing");
      if (!info.tabs) extra.push("tab bar missing");
      if (info.busy) extra.push("still loading (main aria-busy) after 25 s");
      if (info.overflow > 1) extra.push(`page ${info.overflow}px wider than the viewport`);
      if (info.controls === 0) extra.push("no visible control in main");
      if (info.hash !== `#${route}`) extra.push(`landed on ${info.hash}`);
      const reasons = judge(problems, extra);
      rows.push({
        check: `#${route}`,
        viewport: vp.name,
        ok: reasons.length === 0,
        heading: info.heading,
        reasons,
        warnings: problems.other,
        file,
      });
      console.log(`${reasons.length ? "FAIL" : "ok  "} #${route} ${vp.name}${reasons.length ? `: ${reasons.join("; ")}` : ""}`);
    }
  }

  // ---------- interactions (desktop) ----------
  let cdp = null;
  const interaction = async (name, body) => {
    const reasons = [];
    const file = join(outDir, `interaction-${name}.png`);
    cdp = await browser.newPage(VIEWPORTS[0]);
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
    rows.push({ check: name, viewport: "desktop", ok: all.length === 0, heading: "", reasons: all, warnings: problems.other, file });
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

  await interaction("tabs", async (idle, reasons) => {
    await load(cdp, `${base}/#treat`, idle);
    for (const route of ["alerts", "report", "timeline", "treat"]) {
      const clicked = await evaluate(
        cdp,
        `(() => { const a = document.querySelector('nav.app-tabs a[href="#${route}"]'); if (!a) return false; a.click(); return true; })()`,
      );
      if (!clicked) {
        reasons.push(`no tab link to #${route}`);
        continue;
      }
      const ok = await waitIn(`location.hash === "#${route}" && !!document.querySelector("main h1")?.textContent.trim()`, 15_000);
      if (!ok) {
        const seen = await evaluate(
          cdp,
          `location.hash + " | h1: " + (document.querySelector("main h1")?.textContent ?? "none") + " | main: " + (document.querySelector("main")?.innerText ?? "").slice(0, 120).replace(/s+/g, " ")`,
        );
        reasons.push(`tab #${route}: no heading 15 s after the click (${seen})`);
      }
      await idle();
    }
  });

  await interaction("step-one-day", async (idle, reasons) => {
    await load(cdp, `${base}/#treat`, idle);
    const before = await evaluate(cdp, `document.querySelector(".app-fresh-text")?.textContent ?? ""`);
    if (!before) reasons.push("no date chip (.app-fresh-text)");
    const clicked = await evaluate(
      cdp,
      `(() => {
      const b = [...document.querySelectorAll(".app-sim button")].find((x) => /\\+\\s?1\\b/.test(x.textContent) && !x.disabled);
      if (!b) return false; b.click(); return true; })()`,
    );
    if (!clicked) {
      reasons.push("no enabled +1 day button in the simulation bar");
      return;
    }
    const changed = await waitIn(`(document.querySelector(".app-fresh-text")?.textContent ?? "") !== ${JSON.stringify(before)}`, 15_000);
    if (!changed) reasons.push(`date chip still "${before}" 15 s after +1 day`);
    await idle();
  });

  await interaction("language", async (idle, reasons) => {
    await load(cdp, `${base}/#settings`, idle);
    const before = await evaluate(cdp, `document.querySelector("nav.app-tabs")?.textContent ?? ""`);
    const clicked = await evaluate(
      cdp,
      `(() => {
      const r = [...document.querySelectorAll("main [role=radio]")].find((x) => x.querySelector("[lang]") && x.getAttribute("aria-checked") !== "true");
      if (!r) return false; r.click(); return r.querySelector("[lang]").getAttribute("lang"); })()`,
    );
    if (!clicked) {
      reasons.push("no language choice in Settings");
      return;
    }
    const changed = await waitIn(`(document.querySelector("nav.app-tabs")?.textContent ?? "") !== ${JSON.stringify(before)}`);
    if (!changed) reasons.push(`tab labels unchanged after choosing "${clicked}"`);
    await idle();
  });

  await interaction("data-check-details", async (idle, reasons) => {
    await load(cdp, `${base}/#settings`, idle);
    await evaluate(cdp, `document.querySelector(".k-quality-list")?.closest(".k-disc")?.querySelector("button")?.click()`);
    const expanded = await waitIn(
      `document.querySelector(".k-quality-list")?.closest(".k-disc")?.querySelector("button")?.getAttribute("aria-expanded") === "true"`,
    );
    if (!expanded) reasons.push("data-check disclosure did not expand");
    const checks = await evaluate(
      cdp,
      `[...document.querySelectorAll(".k-quality-list li")].filter(el => el.getBoundingClientRect().height > 0).length`,
    );
    if (checks !== 15) reasons.push(`expected fifteen visible data checks after expanding, got ${checks}`);
  });

  await interaction("regional-jump", async (idle, reasons) => {
    await load(cdp, `${base}/#timeline`, idle);
    const jump = await evaluate(
      cdp,
      `(() => {
      document.querySelector(".timeline-region-jump")?.click();
      const panel = document.getElementById("timeline-region");
      return {
        focused: document.activeElement === panel,
        top: panel?.getBoundingClientRect().top ?? -1,
        headerBottom: document.querySelector(".app-top")?.getBoundingClientRect().bottom ?? 0,
        hash: location.hash,
      };
    })()`,
    );
    if (!jump.focused || jump.hash !== "#timeline") reasons.push("county jump did not focus the panel on Timeline");
    if (jump.top < jump.headerBottom - 1) reasons.push("county panel scrolled behind the sticky header");
  });

  await interaction("alerts-last-visit", async (idle, reasons) => {
    await load(cdp, `${base}/#settings`, idle);
    await evaluate(
      cdp,
      `localStorage.setItem("aei.alertsLastOpened", JSON.stringify("2026-10-14T14:00:00.000Z"));
      document.querySelector('nav.app-tabs a[href="#alerts"]')?.click();`,
    );
    const previous = await waitIn(
      `!!document.querySelector(".alerts-head") && /14.*2026/.test(document.querySelector(".alerts-head").textContent)`,
    );
    if (!previous) reasons.push("Alerts did not show the previous browser visit");
    const stored = await evaluate(cdp, `JSON.parse(localStorage.getItem("aei.alertsLastOpened"))`);
    if (!stored || stored === "2026-10-14T14:00:00.000Z" || !Number.isFinite(Date.parse(stored))) {
      reasons.push("opening Alerts did not record a new browser timestamp");
    }
    await idle();
  });

  // Eight tabs at once in one browser: HTTP/1.1 allows six connections per host, so the app must share one
  // live stream across tabs (src/feed) or the seventh tab never loads.
  await interaction("eight-tabs", async (idle, reasons) => {
    await load(cdp, `${base}/#alerts`, idle);
    const extra = [];
    try {
      for (let i = 0; i < 7; i++) {
        const p = await browser.newPage(VIEWPORTS[0]);
        extra.push(p);
        await p.send("Page.navigate", { url: `${base}/#${ROUTES[i % ROUTES.length]}` });
      }
      const loaded = async (p) => {
        const until = Date.now() + 25_000;
        while (Date.now() < until) {
          const ok = await evaluate(
            p,
            `!!document.querySelector("main h1")?.textContent.trim() && document.querySelector("main").getAttribute("aria-busy") !== "true"`,
          ).catch(() => false);
          if (ok) return true;
          await sleep(250);
        }
        return false;
      };
      const results = await Promise.all(extra.map(loaded));
      results.forEach((ok, i) => {
        if (!ok) reasons.push(`tab ${i + 2} of 8 (#${ROUTES[i % ROUTES.length]}) did not finish loading in 25 s`);
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
