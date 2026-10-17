// Records the demo (DEMO.md) as a video, as a backup for a live run: headless Chrome plays the steps
// against a server holding results up to 1 June 2025 while scripts/send_lab_results.py sends 2 to 8 June.
//
//     node scripts/record_demo.mjs [--lang en|fi] [--out demo.mp4]
//
// Needs Chrome (or $CHROME), ffmpeg and uv, the dataset in data/synthetic_microbiology_dataset and,
// for step 4, data/external/thl/regional.json (uv run python scripts/fetch_thl_ttr.py).
// Ports 8796 (API) and 5174 (web). About two minutes.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const lang = arg("lang", "en");
const out = resolve(arg("out", join(ROOT, `demo-${lang}.mp4`)));
const API = 8796;
const WEB = 5174;
const base = `http://localhost:${WEB}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const children = [];
const start = (cmd, args, cwd, env) => {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "ignore", detached: true });
  children.push(child);
  return child;
};
const stopAll = () => {
  for (const c of children)
    try {
      process.kill(-c.pid);
    } catch {}
};
// Temporary directories (the Chrome profile, the frames) go however the script ends.
const temps = [];
const tempDir = (prefix) => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
};
process.on("exit", () => {
  stopAll();
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

async function waitFor(url) {
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`${url} did not come up`);
}

start("node", ["src/main.ts"], join(ROOT, "apps/api"), {
  AEI_PORT: String(API),
  AEI_LOAD_UNTIL: "2025-06-01",
  AEI_REGIONAL: join(ROOT, "data/external/thl/regional.json"),
});
start("npx", ["vite", "--port", String(WEB), "--strictPort"], join(ROOT, "apps/web"), { AEI_FEED_URL: `http://localhost:${API}` });
await waitFor(`http://localhost:${API}/api/meta`);
await waitFor(base);

// ---------- Chrome over the DevTools protocol ----------
const profile = tempDir("aei-record-");
const chrome = start(
  process.env.CHROME ?? "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--hide-scrollbars",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=9334",
    "--window-size=1440,900",
    "about:blank",
  ],
  ROOT,
  {},
);
let targets;
for (let i = 0; i < 100 && !targets; i++) {
  try {
    targets = await (await fetch("http://127.0.0.1:9334/json")).json();
  } catch {
    await sleep(200);
  }
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const frames = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const js = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// Settings the app keeps in localStorage ("aei.<key>"): language, and Urology as the doctor's unit.
await send("Page.navigate", { url: base });
await sleep(1500);
await js(
  `localStorage.setItem("aei.lang", ${JSON.stringify(lang)}); localStorage.setItem("aei.ward", '"URO"'); localStorage.setItem("aei.route", '"alerts"');`,
);
await send("Page.navigate", { url: `${base}/#alerts` });
await send("Page.reload"); // a hash change alone keeps the app running with its old settings
await sleep(3000);
await js(`location.hash = "#alerts"`);
await sleep(5000);
// Five screenshots a second: headless Chrome's screencast only sends frames on some repaints.
let recording = true;
const capture = (async () => {
  while (recording) {
    const t = Date.now();
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
    if (shot?.data) frames.push({ data: shot.data, t: t / 1000 });
    await sleep(Math.max(0, 200 - (Date.now() - t)));
  }
})();

// 1-2. The lab feed arrives day by day; the Urology alert comes on 4 June, its incident grows on 8 June.
await sleep(3000);
await new Promise((done) =>
  spawn(
    "uv",
    [
      "run",
      "python",
      "scripts/send_lab_results.py",
      "--from",
      "2025-06-02",
      "--to",
      "2025-06-08",
      "--format",
      "hl7",
      "--pause",
      "2.5",
      "--url",
      `http://localhost:${API}/api/ingest`,
    ],
    {
      cwd: ROOT,
      stdio: "ignore",
    },
  ).on("exit", done),
);
await sleep(2000);
await js(`document.querySelector("main [aria-pressed], main .is-selected, main article")?.scrollIntoView({ block: "start" })`);
await sleep(5000);

// 3. What works on Urology for urine: mild first, then severe.
await send("Page.navigate", { url: `${base}/#treat` });
await sleep(7000);
for (const y of [140, 280, 420]) {
  await js(`window.scrollTo(0, ${y})`);
  await sleep(1200);
}
await sleep(2500);
await js(`window.scrollTo(0, 0)`);
await sleep(1000);
const severe = await js(
  `(() => { const b = [...document.querySelectorAll("main [role=radio], main button")].find((x) => /^(Severe|Vaikea)$/.test(x.textContent.trim())); b?.click(); return !!b; })()`,
);
if (!severe.result?.value) console.error("no Severe control found");
await sleep(7000);

// 4. The region: the clock moves to 3 October 2025; Varsinais-Suomi's CPE E. coli signal of September.
await fetch(`http://localhost:${API}/api/clock`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "seek", date: "2025-10-03" }),
});
await send("Page.navigate", { url: `${base}/#timeline` });
await sleep(5000);
await js(
  `[...document.querySelectorAll("main h2, main h3")].find((h) => /region|^alue/i.test(h.textContent.trim()))?.scrollIntoView({ behavior: "smooth", block: "start" })`,
);
await sleep(10000);
recording = false;
await capture;
ws.close();

// ---------- frames to video: each frame shown until the next one ----------
const dir = tempDir("aei-frames-");
const list = [];
frames.forEach((f, i) => {
  const file = join(dir, `${String(i).padStart(5, "0")}.jpg`);
  writeFileSync(file, Buffer.from(f.data, "base64"));
  const next = frames[i + 1]?.t ?? f.t + 2;
  list.push(`file '${file}'`, `duration ${Math.max(0.04, next - f.t).toFixed(3)}`);
});
list.push(`file '${join(dir, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
writeFileSync(join(dir, "list.txt"), list.join("\n"));
const ff = spawnSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  join(dir, "list.txt"),
  "-vf",
  "fps=25,format=yuv420p",
  "-c:v",
  "libx264",
  "-crf",
  "23",
  out,
]);
chrome.kill();
if (ff.status !== 0) {
  console.error(String(ff.stderr));
  process.exit(1);
}
const seconds = frames.length ? (frames.at(-1).t - frames[0].t).toFixed(0) : 0;
console.log(`${frames.length} frames, ${seconds} s -> ${out}`);
process.exit(0);
