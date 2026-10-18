import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Several hospitals on one server (D-051): ingest attribution by token, GET /api/sites, statistics per site.

let dir: string;
let api: Server | undefined;

async function stop(server?: Server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

const SATA = {
  id: "sata",
  fi: "Satasairaala",
  en: "Satasairaala",
  county: "Satakunnan hyvinvointialue",
  token: "sata-token",
  wards: [{ code: "ICU", fi: "Teho-osasto", en: "Intensive care unit", type: "in", institution: "hospital" }],
};

beforeEach(async () => {
  vi.resetModules();
  dir = await mkdtemp(join(tmpdir(), "aei-sites-test-"));
  const files = {
    "patients.csv": "patient_id,sex,birth_year,home_area\np1,M,1950,South\np2,F,1960,West\n",
    "cultures.csv":
      "culture_id,patient_id,age_years,sample_date,ward_code,ward_type,specimen,result,n_isolates\nc1,p1,75,2025-03-01,URO,in,urine,positive,1\nc2,p1,75,2025-04-20,URO,in,urine,positive,1\nc3,p2,65,2025-04-21,ICU,in,urine,positive,1\nc4,p2,65,2025-06-01,ICU,in,urine,positive,1\n",
    "isolates.csv":
      "isolate_id,culture_id,isolate_no,organism,esbl,cpe\ni1,c1,1,Escherichia coli,1,0\ni2,c2,1,Escherichia coli,1,0\ni3,c3,1,Escherichia coli,0,0\ni4,c4,1,Escherichia coli,0,0\n",
    "susceptibility.csv": "isolate_id,antibiotic_code,result,guideline\ni1,CIP,S,EUCAST\ni2,CIP,S,EUCAST\ni3,CIP,S,EUCAST\n",
  };
  await Promise.all(Object.entries(files).map(([name, data]) => writeFile(join(dir, name), data)));
  vi.stubEnv("AEI_DATA_DIR", dir);
  vi.stubEnv("AEI_PORT", "0");
  vi.stubEnv("AEI_REPLAY_START", "2025-05-01");
  vi.stubEnv("AEI_LLM_URL", "");
  vi.stubEnv("AEI_LLM_KEY", "");
  vi.stubEnv("AEI_LLM_ACCESS_ID", "");
  vi.stubEnv("AEI_LLM_ACCESS_SECRET", "");
});
afterEach(async () => {
  await stop(api);
  api = undefined;
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

async function startApi(sites?: unknown) {
  if (sites) {
    const file = join(dir, "sites.json");
    await writeFile(file, JSON.stringify(sites), { mode: 0o600 });
    vi.stubEnv("AEI_SITES", file);
  }
  api = (await import("./main.ts")).server;
  if (!api.listening) await once(api, "listening");
  const address = api.address();
  if (!address || typeof address === "string") throw new Error("No listening address");
  return `http://127.0.0.1:${address.port}`;
}

/** One CSV culture: patient p1 (also a Tyks patient) sampled at `ward` on the clock's day. */
const csv = (culture: string, ward: string, patient = "p1") =>
  `patient_id,sex,birth_year,culture_id,sample_date,ward,specimen,organism,CIP\n${patient},M,1950,${culture},2025-05-01,${ward},urine,E. coli,R\n`;

const post = (base: string, body: string, token?: string) =>
  fetch(`${base}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "text/csv", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body,
  });

describe("one hospital, no sites file", () => {
  it("lists the home site alone and takes results without a token as before", async () => {
    const base = await startApi();
    const sites = await (await fetch(`${base}/api/sites`)).json();
    expect(sites.sites.map((s: { id: string; status: string }) => [s.id, s.status])).toEqual([["tyks", "home"]]);
    expect(sites.sites[0].guide).toBe("varha");
    expect((await post(base, csv("t1", "URO"))).status).toBe(200);
    expect((await post(base, csv("t2", "URO"), "anything")).status).toBe(401);
    const meta = await (await fetch(`${base}/api/meta`)).json();
    expect(meta.sites).toHaveLength(1);
    expect(meta.wards.every((w: { site: string }) => w.site === "tyks")).toBe(true);
  });
});

describe("a second hospital", () => {
  it("attributes results by token, qualifies its units and reports its feed", async () => {
    const base = await startApi({ sites: [SATA] });
    expect((await post(base, csv("s1", "ICU"), "wrong")).status).toBe(401);
    const res = await post(base, csv("s1", "ICU"), "sata-token");
    expect(res.status).toBe(200);
    const accepted = await res.json();

    expect(accepted.site).toBe("sata");
    const unregistered = await (await post(base, csv("s2", "CARD", "p9"), "sata-token")).json();
    expect(unregistered.warnings.some((w: string) => w.includes("not registered"))).toBe(true);

    const isolates = await (await fetch(`${base}/api/isolates?site=sata`)).json();
    expect(isolates.records.map((r: { ward: string }) => r.ward).sort()).toEqual(["sata/CARD", "sata/ICU"]);
    const sites = await (await fetch(`${base}/api/sites`)).json();
    const sata = sites.sites.find((s: { id: string }) => s.id === "sata");
    expect(sata).toMatchObject({
      status: "connected",
      wards: ["sata/ICU"],
      counts: { cultures: 2, isolates: 2, patients: 2 },
      feed: { messages: 2, lastFormat: "csv", lastAccepted: 1, unregistered: 1, rejected: 0 },
    });
    expect(sites.sites[0]).toMatchObject({ id: "tyks", status: "home", counts: { cultures: 3 } });
    expect((await fetch(`${base}/api/alerts?site=nowhere`)).status).toBe(400);
  });

  it("keeps the home site's statistics and shows the move between hospitals", async () => {
    const base = await startApi({ sites: [SATA] });
    const before = await (await fetch(`${base}/api/coverage?ward=URO&specimen=urine`)).json();
    expect((await post(base, csv("s1", "ICU"), "sata-token")).status).toBe(200);
    const after = await (await fetch(`${base}/api/coverage?ward=URO&specimen=urine`)).json();
    expect(after.coverage).toEqual(before.coverage);
    const theirs = await (await fetch(`${base}/api/coverage?ward=ICU&site=sata&specimen=urine`)).json();
    expect(theirs.coverage.query.ward).toBe("sata/ICU");
    expect(theirs.coverage.isolates).toBe(1);

    const flows = (await (await fetch(`${base}/api/relations?days=28`)).json()).flows;
    expect(flows).toContainEqual({ from: "URO", to: "sata/ICU", patients: 1 });
    const theirFlows = (await (await fetch(`${base}/api/relations?days=28&site=sata`)).json()).flows;
    expect(theirFlows.every((f: { from: string; to: string }) => f.from.startsWith("sata/") || f.to.startsWith("sata/"))).toBe(true);

    const weekly = await (await fetch(`${base}/api/weekly?from=2025-04-14&site=sata`)).json();
    expect(Object.keys(weekly.units)).toEqual(["sata/ICU"]);
    const home = await (await fetch(`${base}/api/weekly?from=2025-04-14`)).json();
    expect(Object.keys(home.units)).not.toContain("sata/ICU");
    const quality = await (await fetch(`${base}/api/quality?site=sata`)).json();
    expect(quality.checked.cultures).toBe(1);
  });

  it("asks the home site for a token once it has one, and stops on an invalid file", async () => {
    const base = await startApi({ sites: [SATA, { id: "tyks", token: "tyks-token" }] });
    expect((await post(base, csv("t1", "URO"))).status).toBe(401);
    expect((await post(base, csv("t1", "URO"), "tyks-token")).status).toBe(200);
    await stop(api);
    api = undefined;
    vi.resetModules();
    await expect(startApi({ sites: [SATA, SATA] })).rejects.toThrow(/duplicate id/);
  });
});

describe("Ask by hospital", () => {
  let model: Server | undefined;
  afterEach(async () => {
    await stop(model);
    model = undefined;
  });

  it("reads the question against one hospital's units: the named site's, or the home site's", async () => {
    const prompts: string[] = [];
    model = createServer(async (req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.method === "GET") return void res.end(JSON.stringify({ object: "list", data: [{ id: "local-test" }] }));
      let raw = "";
      for await (const chunk of req) raw += chunk;
      prompts.push(JSON.parse(raw).messages[0].content);
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ward: null, unmatched: [] }) } }] }));
    }).listen(0);
    await once(model, "listening");
    const address = model.address();
    if (!address || typeof address === "string") throw new Error("No listening address");
    vi.stubEnv("AEI_LLM_URL", `http://127.0.0.1:${address.port}`);
    vi.stubEnv("AEI_LLM_MODEL", "local-test");
    const base = await startApi({ sites: [SATA] });
    const ask = (body: object) =>
      fetch(`${base}/api/ask`, { method: "POST", body: JSON.stringify({ text: "esbl in icu", lang: "en", ...body }) });
    expect((await ask({})).status).toBe(200);
    expect((await ask({ site: "sata" })).status).toBe(200);
    expect((await ask({ site: "nowhere" })).status).toBe(400);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toMatch(/^ {2}ICU: /m);
    expect(prompts[0]).not.toContain("sata/ICU");
    expect(prompts[1]).toContain("sata/ICU");
    expect(prompts[1]).not.toMatch(/^ {2}(ICU|URO): /m);
  });
});
