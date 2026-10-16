// Screenshots of the running web app at phone (390 px, mobile emulation) and
// laptop (1280 px) width, through headless Chrome's DevTools protocol, with
// a real wait so live data has arrived. Node 22+ (built-in WebSocket), no
// dependencies.
//
// usage: node shoot.mjs <base-url> <label> [surface...] [--wait=ms]
//   surface is a hash route ("home" is the root), e.g. doctor "research?panel=map"
// Writes <surface>-<label>-phone.png and -laptop.png next to this script;
// "?", "=" and "&" in the surface become "-".

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const wait = Number(args.find((a) => a.startsWith("--wait="))?.slice(7) ?? 6000);
const [base, label, ...rest] = args.filter((a) => !a.startsWith("--"));
const surfaces = rest.length ? rest : ["home", "doctor", "research", "settings"];
if (!base || !label) {
  console.error("usage: node shoot.mjs <base-url> <label> [surface...] [--wait=ms]");
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
const sizes = [
  { name: "phone", width: 390, height: 844, mobile: true, scale: 2 },
  { name: "laptop", width: 1280, height: 860, mobile: false, scale: 1 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "aei-shoot-"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [
  "--headless=new",
  "--hide-scrollbars",
  "--no-first-run",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank",
]);

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

try {
  const ws = new WebSocket(await target());
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send("Page.enable");
  for (const surface of surfaces) {
    for (const s of sizes) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: s.width,
        height: s.height,
        deviceScaleFactor: s.scale,
        mobile: s.mobile,
      });
      await send("Emulation.setTouchEmulationEnabled", { enabled: s.mobile });
      const url = `${base}/${surface === "home" ? "" : `#${surface}`}`;
      await send("Page.navigate", { url: "about:blank" });
      await send("Page.navigate", { url });
      await sleep(wait);
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      const file = join(here, `${surface.replace(/[?=&]/g, "-")}-${label}-${s.name}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(file);
    }
  }
  ws.close();
} finally {
  chrome.kill();
  await new Promise((r) => chrome.once("exit", r));
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
