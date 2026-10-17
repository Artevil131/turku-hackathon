import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAeiClient, type ProjectInput } from "@aei/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
let api: Server | undefined;
let upstream: Server | undefined;

function origin(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No listening address");
  return `http://127.0.0.1:${address.port}`;
}
async function stop(server?: Server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

beforeEach(async () => {
  vi.resetModules();
  dir = await mkdtemp(join(tmpdir(), "aei-api-test-"));
  const files = {
    "patients.csv": "patient_id,sex,birth_year,home_area\np0,F,2025,North\np1,M,1950,South\np2,F,1960,West\n",
    "cultures.csv":
      "culture_id,patient_id,age_years,sample_date,ward_code,ward_type,specimen,result,n_isolates\nc0,p0,0,2025-03-01,ICU,in,urine,positive,1\nc1,p1,75,2025-03-01,URO,in,urine,positive,1\nc2,p1,75,2025-05-01,ICU,in,urine,positive,1\nc3,p2,65,2025-06-01,ICU,in,blood,positive,1\n",
    "isolates.csv":
      "isolate_id,culture_id,isolate_no,organism,esbl,cpe\ni0,c0,1,Escherichia coli,0,0\ni1,c1,1,Escherichia coli,1,0\ni2,c2,1,Escherichia coli,1,1\ni3,c3,1,Klebsiella pneumoniae,0,1\n",
    "susceptibility.csv":
      "isolate_id,antibiotic_code,result,guideline\ni0,AMP,S,EUCAST\ni1,AMP,R,EUCAST\ni2,AMP,R,EUCAST\ni3,MEM,R,EUCAST\n",
  };
  await Promise.all(Object.entries(files).map(([name, data]) => writeFile(join(dir, name), data)));
  vi.stubEnv("AEI_STATE_DIR", "");
  vi.stubEnv("AEI_SITES", "");
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
  await stop(upstream);
  api = undefined;
  upstream = undefined;
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});
async function startApi() {
  api = (await import("./main.ts")).server;
  if (!api.listening) await once(api, "listening");
  return origin(api);
}

describe("research projects (D-057, D-058)", () => {
  const input: ProjectInput = {
    name: "ESBL study",
    mode: "continuous",
    scope: { units: [], organisms: [], phenotypes: [], kinds: [], board: "unit=URO&ph=ESBL" },
  };
  // Projects belong to the browser's anonymous visitor cookie, so these requests carry one, as one browser would.
  const VISITOR = "0123456789abcdef0123456789abcdef";
  const realFetch = globalThis.fetch;
  const withVisitor =
    (visitor: string): typeof fetch =>
    (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("cookie", `aei_visitor=${visitor}`);
      return realFetch(input, { ...init, headers });
    };
  beforeEach(() => {
    globalThis.fetch = withVisitor(VISITOR);
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("keeps each visitor's projects apart and gives a new browser its cookie", async () => {
    const base = await startApi();
    const first = await realFetch(`${base}/api/projects`);
    expect(first.headers.get("set-cookie")).toMatch(/^aei_visitor=[a-f0-9]{32}; Path=\/; Max-Age=31536000; SameSite=Lax; HttpOnly$/);
    const mine = createAeiClient({ baseUrl: base });
    const theirs = createAeiClient({ baseUrl: base, fetch: withVisitor("fedcba9876543210fedcba9876543210") });
    const { project } = await mine.createProject(input);
    expect((await mine.projects()).projects.map((p) => p.id)).toEqual([project.id]);
    expect((await theirs.projects()).projects).toEqual([]);
    await expect(theirs.project(project.id)).rejects.toThrow();
    expect(
      (await withVisitor("fedcba9876543210fedcba9876543210")(`${base}/api/lite/files/projects/${project.id}/reproduce.ipynb`)).status,
    ).toBe(404);
  });

  it("serves JupyterLite project listings and reproducible files without reports or figures", async () => {
    const base = await startApi();
    const client = createAeiClient({ baseUrl: base });
    const root = `${base}/api/lite/contents/projects/all.json`;
    expect(await (await fetch(root)).json()).toMatchObject({
      name: "projects",
      path: "projects",
      type: "directory",
      format: "json",
      content: [],
    });
    const { project } = await client.createProject({
      ...input,
      name: "Study ä",
      mode: "frozen",
      asOf: "2025-05-01",
      scope: { ...input.scope, units: ["ICU"] },
    });
    const listing = await (await fetch(root)).json();
    expect(listing.content).toEqual([
      expect.objectContaining({
        name: project.id,
        path: `projects/${project.id}`,
        type: "directory",
        content: null,
        format: null,
        mimetype: null,
        size: null,
        writable: true,
        created: project.createdAt,
        last_modified: project.updatedAt,
      }),
    ]);
    const contentsUrl = `${base}/api/lite/contents/projects/${project.id}/all.json`;
    const contents = await (await fetch(contentsUrl)).json();
    expect(contents).toMatchObject({ path: `projects/${project.id}`, name: project.id, type: "directory", format: "json" });
    expect(contents.content.map((file: { name: string }) => file.name)).toEqual([
      "datapackage.json",
      "isolates.csv",
      "alerts.csv",
      "methods.json",
      "README.md",
      "analysis.py",
      "analysis.R",
      "reproduce.ipynb",
      "reproduce-r.ipynb",
    ]);
    const fileBase = `${base}/api/lite/files/projects/${project.id}`;
    const response = await fetch(`${fileBase}/datapackage.json`);
    expect(response.headers.get("content-type")).toBe("application/json");
    const body = await response.text();
    const descriptor = JSON.parse(body);
    expect(descriptor.aei).toMatchObject({ asOf: project.asOf, mode: "frozen", scope: project.scope, fingerprint: project.fingerprint });
    expect(contents.content.find((file: { name: string }) => file.name === "datapackage.json")).toMatchObject({
      type: "file",
      format: null,
      mimetype: "application/json",
      size: Buffer.byteLength(body),
      content: null,
    });
    const notebookResponse = await fetch(`${fileBase}/reproduce.ipynb`);
    expect(notebookResponse.headers.get("content-type")).toBe("application/x-ipynb+json");
    const notebook = await notebookResponse.json();
    expect(notebook).toMatchObject({
      nbformat: 4,
      metadata: { kernelspec: { name: "python", display_name: "Python (Pyodide)", language: "python" } },
    });
    expect((await (await fetch(`${fileBase}/reproduce-r.ipynb`)).json()).metadata.kernelspec).toEqual({
      name: "xr",
      display_name: "R 4.5.1 (xr)",
      language: "R",
    });
    expect(notebook.cells.some((cell: { source: string }) => cell.source.includes("aei.reproduce(pkg)"))).toBe(true);
    expect(contents.content.find((file: { name: string }) => file.name === "reproduce.ipynb")).toMatchObject({
      type: "notebook",
      mimetype: "application/x-ipynb+json",
      size: expect.any(Number),
    });
    expect(await (await fetch(`${fileBase}/datapackage.json`)).text()).toBe(body); // same cached package
    const numbers = await (await fetch(`${fileBase}/methods.json`)).json();
    expect(numbers.find((number: { id: string }) => number.id === "isolates")).toMatchObject({
      value: 2,
      recipe: { op: "count", table: "isolates" },
    });
    const csv = await (await fetch(`${fileBase}/isolates.csv`)).text();
    expect(csv).toContain("i0,c0,p0");
    expect(csv).toContain("i2,c2,p1");
    expect(csv).not.toContain("i1,c1,p1");
    expect(csv).not.toContain("i3,c3,p2");
    // Seeking back cannot expose rows later than the replay clock, even for a frozen project.
    await client.command({ action: "seek", date: "2025-03-01" });
    expect((await (await fetch(`${fileBase}/methods.json`)).json()).find((number: { id: string }) => number.id === "isolates").value).toBe(
      1,
    );
    // Edits replace the cached package; unknown projects and non-package paths never resolve.
    await client.updateProject(project.id, { ...input, name: "Changed", scope: { ...input.scope, units: ["URO"] } });
    expect((await (await fetch(`${fileBase}/datapackage.json`)).json()).title).toBe("Changed");
    for (const path of [
      "/api/lite/contents/projects/missing/all.json",
      "/api/lite/contents/projects/INVALID/all.json",
      `/api/lite/contents/projects/${project.id}/extra/all.json`,
      `/api/lite/files/projects/${project.id}/missing.csv`,
      `/api/lite/files/projects/${project.id}/report.docx`,
      `/api/lite/files/projects/${project.id}/figures/a.svg`,
      `/api/lite/files/projects/${project.id}/%2e%2e%2fdatapackage.json`,
      "/api/lite/files/projects/missing/datapackage.json",
    ])
      expect((await fetch(`${base}${path}`)).status).toBe(404);
    await client.deleteProject(project.id);
    expect((await fetch(contentsUrl)).status).toBe(404);
  }, 15_000);

  it("creates, lists, reads, replaces and deletes through the typed client and persists across restart", async () => {
    vi.stubEnv("AEI_STATE_DIR", dir);
    const base = await startApi();
    const client = createAeiClient({ baseUrl: base });
    expect(await client.projects()).toEqual({ projects: [] });
    const raw = await fetch(`${base}/api/projects`, { method: "POST", body: JSON.stringify(input) });
    expect(raw.status).toBe(201);
    const { project } = await raw.json();
    expect(project).toMatchObject({ ...input, description: "", id: expect.stringMatching(/^[a-z0-9-]{1,64}$/) });
    expect((await client.projects()).projects).toEqual([project]);
    expect(await client.project(project.id)).toEqual({ project });
    const updated = await client.updateProject(project.id, { ...input, name: "Renamed", description: "Question" });
    expect(updated.project).toMatchObject({ id: project.id, createdAt: project.createdAt, name: "Renamed", description: "Question" });
    await stop(api);
    api = undefined;
    vi.resetModules();
    const restarted = createAeiClient({ baseUrl: await startApi() });
    expect(await restarted.project(project.id)).toEqual(updated);
    await restarted.deleteProject(project.id); // 204 has no JSON body.
    expect(await restarted.projects()).toEqual({ projects: [] });
    await expect(restarted.project(project.id)).rejects.toMatchObject({ status: 404 });
    await expect(restarted.deleteProject(project.id)).rejects.toMatchObject({ status: 404 });
  });

  it("roundtrips opaque project layouts and rejects oversized layouts", async () => {
    vi.stubEnv("AEI_STATE_DIR", dir);
    const base = await startApi();
    const client = createAeiClient({ baseUrl: base });
    const layout = { v: 2, columns: [], closed: {}, maximized: null };
    const created = await client.createProject({ ...input, layout });
    expect(created.project.layout).toEqual(layout);
    const changed = { ...layout, maximized: "coverage" };
    await client.updateProject(created.project.id, { ...input, layout: changed });
    expect((await client.project(created.project.id)).project.layout).toEqual(changed);
    for (const layout of [[], null, { text: "x".repeat(20_000) }]) {
      const response = await fetch(`${base}/api/projects`, { method: "POST", body: JSON.stringify({ ...input, layout }) });
      expect(response.status).toBe(400);
    }
    await stop(api);
    api = undefined;
    vi.resetModules();
    const restarted = createAeiClient({ baseUrl: await startApi() });
    expect((await restarted.project(created.project.id)).project.layout).toEqual(changed);
  });

  it("pins frozen rows without moving the clock, reports drift and only repins when the cut changes", async () => {
    const base = await startApi();
    const client = createAeiClient({ baseUrl: base });
    const frozen: ProjectInput = {
      ...input,
      mode: "frozen",
      asOf: "2025-06-01",
      scope: { ...input.scope, units: ["ICU"], phenotypes: ["cpe"] },
    };
    // Rows after the replay clock are not released, so a cut beyond it is refused.
    await expect(client.createProject(frozen)).rejects.toMatchObject({ status: 400 });
    await client.command({ action: "seek", date: "2025-06-01" });
    const { project } = await client.createProject(frozen);
    expect(project.fingerprint?.rows).toBe(2);
    expect(await client.project(project.id)).toEqual({ project, drift: false });
    expect((await client.clock()).asOf).toBe("2025-06-01");
    const methodsUrl = `${base}/api/lite/files/projects/${project.id}/methods.json`;
    const exportedIsolates = async () =>
      (await (await fetch(methodsUrl)).json()).find((number: { id: string }) => number.id === "isolates").value;
    expect(await exportedIsolates()).toBe(2);
    const body =
      "patient_id,sex,birth_year,culture_id,sample_date,ward,specimen,organism,cpe,MEM\np9,F,1950,c9,2025-05-01,ICU,urine,Klebsiella pneumoniae,1,R\n";
    expect((await client.ingest(body, "text/csv")).status).toBe(200);
    expect(await exportedIsolates()).toBe(3); // same clock and project version, corrected data invalidate the package
    expect((await client.project(project.id)).drift).toBe(true);
    // A description edit must not erase evidence that the original frozen rows changed.
    expect((await client.updateProject(project.id, { ...frozen, description: "Still frozen" })).project.fingerprint).toEqual(
      project.fingerprint,
    );
    expect((await client.project(project.id)).drift).toBe(true);
    const repinned = await client.updateProject(project.id, { ...frozen, asOf: "2025-05-01" });
    expect(repinned.project.fingerprint?.rows).toBe(2);
    expect((await client.project(project.id)).drift).toBe(false);
    const continuous = await client.updateProject(project.id, input);
    expect(continuous.project.fingerprint).toBeUndefined();
    expect(await client.project(project.id)).toEqual(continuous);
  });

  it("scopes frozen fingerprints to the same site as isolates and rejects bad ids/input", async () => {
    const file = join(dir, "sites.json");
    await writeFile(
      file,
      JSON.stringify({
        sites: [
          {
            id: "sata",
            fi: "Sata",
            en: "Sata",
            county: "Satakunnan hyvinvointialue",
            token: "sata-token",
            wards: [{ code: "ICU", fi: "ICU", en: "ICU", type: "in", institution: "hospital" }],
          },
        ],
      }),
      { mode: 0o600 },
    );
    vi.stubEnv("AEI_SITES", file);
    const base = await startApi();
    const client = createAeiClient({ baseUrl: base });
    const csv =
      "patient_id,sex,birth_year,culture_id,sample_date,ward,specimen,organism,AMP\np9,F,1950,c9,2025-05-01,ICU,urine,Escherichia coli,R\n";
    expect((await client.ingest(csv, "text/csv", "sata-token")).status).toBe(200);
    const { project } = await client.createProject({
      ...input,
      mode: "frozen",
      asOf: "2025-05-01",
      scope: { ...input.scope, site: "sata" },
    });
    expect(project.fingerprint?.rows).toBe((await client.isolates({ site: "sata" })).records.length);
    expect(project.fingerprint?.rows).toBe(1);
    const exported = await (await fetch(`${base}/api/lite/files/projects/${project.id}/isolates.csv`)).text();
    expect(exported).toContain("sata/ICU");
    expect(exported).not.toContain("i0,c0,p0");
    expect(exported).not.toContain("i2,c2,p1");
    expect((await client.project(project.id)).drift).toBe(false);
    for (const value of [
      { ...input, name: "" },
      { ...input, mode: "frozen" },
      { ...input, scope: { ...input.scope, site: "nowhere" } },
    ]) {
      expect((await fetch(`${base}/api/projects`, { method: "POST", body: JSON.stringify(value) })).status).toBe(400);
    }
    expect((await fetch(`${base}/api/projects`, { method: "POST", body: "{" })).status).toBe(400);
    for (const method of ["GET", "PUT", "DELETE"]) {
      expect(
        (await fetch(`${base}/api/projects/BAD`, { method, ...(method === "PUT" ? { body: JSON.stringify(input) } : {}) })).status,
      ).toBe(400);
      expect(
        (await fetch(`${base}/api/projects/missing`, { method, ...(method === "PUT" ? { body: JSON.stringify(input) } : {}) })).status,
      ).toBe(404);
    }
    const preflight = await fetch(`${base}/api/projects/${project.id}`, { method: "OPTIONS" });
    expect(preflight.headers.get("access-control-allow-methods")).toContain("PUT");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("DELETE");
  });
});

describe("weekly counts route", () => {
  it("counts per unit and week up to the clock and never after it", async () => {
    const base = await startApi();
    const body = await (await fetch(`${base}/api/weekly?from=2025-02-24`)).json();
    expect(body.asOf).toBe("2025-05-01");
    expect(body.weeks.at(-1)).toBe("2025-04-28");
    // URO had one ESBL patient on 2025-03-01; ICU's ESBL+CPE isolate of 2025-05-01 is the as-of day itself.
    expect(body.units.URO.phenotypes.esbl.reduce((a: number, b: number) => a + b, 0)).toBe(1);
    expect(body.units.ICU.phenotypes.cpe.at(-1)).toBe(1);
    // ICU cultures of 2025-03-01 and 2025-05-01 count; the one of 2025-06-01 lies after the clock.
    expect(body.units.ICU.cultures.reduce((a: number, b: number) => a + b, 0)).toBe(2);
    expect((await fetch(`${base}/api/weekly?from=oops`)).status).toBe(400);
  });
});

describe("patient findings route (D-050)", () => {
  it("lists the patient's released findings of the past year, newest first, and never one after the clock", async () => {
    const base = await startApi();
    const body = await (await fetch(`${base}/api/patient/findings?id=p1`)).json();
    expect(body.asOf).toBe("2025-05-01");
    expect(body.patientId).toBe("p1");
    expect(body.findings.map((f: { isolateId: string; phenotype: string }) => `${f.isolateId}:${f.phenotype}`)).toEqual([
      "i2:esbl",
      "i2:cpe",
      "i1:esbl",
    ]);
    expect(body.findings[2]).toEqual({ phenotype: "esbl", date: "2025-03-01", ward: "URO", organism: "Escherichia coli", isolateId: "i1" });
    // EUCAST infers nothing from ESBL or CPE in this dataset's rules; only the phenotypes found are keyed.
    expect(body.affects).toEqual({ esbl: ["AMP", "CXM", "CRO", "CAZ"], cpe: ["AMP", "TZP", "CXM", "CRO", "CAZ", "MEM"] }); // D-052
    // p2's CPE isolate of 2025-06-01 lies after the clock: an empty list, not 404.
    const p2 = await fetch(`${base}/api/patient/findings?id=p2`);
    expect(p2.status).toBe(200);
    expect((await p2.json()).findings).toEqual([]);
    expect((await fetch(`${base}/api/patient/findings`)).status).toBe(400);
    expect((await fetch(`${base}/api/patient/findings?id=`)).status).toBe(400);
  });
});

describe("coverage onset (D-049)", () => {
  it("parses the onset, records it, and judges hospital onset against 90 % whatever the severity", async () => {
    const base = await startApi();
    const any = await (await fetch(`${base}/api/coverage?ward=ICU&specimen=urine`)).json();
    expect([any.bar, any.coverage.query.onset, any.coverage.onsetApplied]).toEqual([0.8, "any", false]);
    const hospital = await (await fetch(`${base}/api/coverage?ward=ICU&specimen=urine&onset=hospital&severity=mild`)).json();
    expect([hospital.bar, hospital.coverage.query.onset]).toEqual([0.9, "hospital"]);
    expect((await fetch(`${base}/api/coverage?ward=ICU&specimen=urine&onset=nosocomial`)).status).toBe(400);
  });
});

describe("coverage route", () => {
  it("applies age group and onset, keys the cache by them and rejects unknown values", async () => {
    const base = await startApi();
    const get = async (q: string) => (await (await fetch(`${base}/api/coverage?ward=ICU&specimen=urine${q}`)).json()).coverage;
    // Released first isolates: i0 (age 0) and i1 (age 75); no admission dates, so none is hospital-onset.
    expect((await get("")).isolates).toBe(2);
    const child = await get("&ageGroup=child");
    expect([child.isolates, child.ageGroupApplied, child.query.ageGroup]).toEqual([1, true, "child"]);
    expect((await get("&ageGroup=older")).isolates).toBe(1);
    const onset = await get("&onset=hospital");
    expect([onset.isolates, onset.onsetApplied, onset.query.onset]).toEqual([0, true, "hospital"]);
    expect((await fetch(`${base}/api/coverage?ward=ICU&specimen=urine&ageGroup=old`)).status).toBe(400);
    expect((await fetch(`${base}/api/coverage?ward=ICU&specimen=urine&onset=community`)).status).toBe(200); // D-049
    expect((await fetch(`${base}/api/coverage?ward=ICU&specimen=urine&onset=nosocomial`)).status).toBe(400);
  });
});

describe("county geometry route", () => {
  it("serves the polygons when the file exists and answers 404 without it", async () => {
    const file = join(dir, "counties.geojson");
    vi.stubEnv("AEI_COUNTIES", file);
    const base = await startApi();
    expect((await fetch(`${base}/api/counties`)).status).toBe(404);
    const geo = { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "X" }, geometry: null }] };
    await writeFile(file, JSON.stringify(geo));
    expect(await (await fetch(`${base}/api/counties`)).json()).toEqual(geo);
  });
});

// Tiny synthetic fixtures and a local fake model only: no dataset sweep or paid calls.
describe("assistant HTTP routes", () => {
  it("disables Ask, filters inclusive ages/sex, and explains released alerts without AI", async () => {
    const base = await startApi();
    expect(await (await fetch(`${base}/api/meta`)).json()).toMatchObject({ ai: false, aiStatus: "off" });
    expect((await fetch(`${base}/api/ask`, { method: "POST", body: JSON.stringify({ text: "older men", lang: "en" }) })).status).toBe(503);
    const zero = await (await fetch(`${base}/api/isolates?sex=F&ageMin=0&ageMax=0`)).json();
    expect(zero.records.map((r: { isolateId: string }) => r.isolateId)).toEqual(["i0"]);
    const older = await (await fetch(`${base}/api/isolates?sex=M&ageMin=75&ageMax=75`)).json();
    expect(older.records.map((r: { isolateId: string }) => r.isolateId)).toEqual(["i1", "i2"]);
    expect((await fetch(`${base}/api/isolates?ageMin=oops`)).status).toBe(400);
    const en = await (await fetch(`${base}/api/explain?id=cpe:i2&lang=en`)).json();
    const fi = await (await fetch(`${base}/api/explain?id=cpe:i2&lang=fi`)).json();
    expect(en).toMatchObject({ id: "cpe:i2", source: "template" });
    expect(en.text).toContain("Intensive care unit");
    expect(fi.text).toContain("Teho-osasto");
    // Carrier arrivals are no longer alerts (D-022).
    expect((await fetch(`${base}/api/explain?id=carrier:c2:esbl&lang=en`)).status).toBe(404);
    expect((await fetch(`${base}/api/explain?id=cpe:i3&lang=en`)).status).toBe(404);
    await fetch(`${base}/api/clock`, { method: "POST", body: JSON.stringify({ action: "seek", date: "2025-03-01" }) });
    // Cache must not reveal an alert after rewinding past its release.
    expect((await fetch(`${base}/api/explain?id=cpe:i2&lang=en`)).status).toBe(404);
  });
  it("grounds parsing in metadata/replay time, caches explanations by language and maps upstream errors to 502", async () => {
    const requests: { messages: { content: string }[] }[] = [];
    let fail = false;
    upstream = createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/v1/models") {
        if (fail) res.writeHead(530).end("origin unreachable");
        else res.setHeader("content-type", "application/json").end(JSON.stringify({ object: "list", data: [{ id: "local-test" }] }));
        return;
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      requests.push(body);
      if (fail) {
        res.writeHead(500).end("unavailable");
        return;
      }
      const parse = body.response_format.json_schema.name === "question_filters";
      const result = parse
        ? {
            ward: "ICU",
            specimen: "urine",
            organism: "Escherichia coli",
            sex: "M",
            ageGroup: "older",
            period: { unit: "month", count: 3 },
            unmatched: ["unknown"],
          }
        : { text: "{organism} in {ward} on {date}." };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
    }).listen(0);
    await once(upstream, "listening");
    vi.stubEnv("AEI_LLM_URL", origin(upstream));
    vi.stubEnv("AEI_LLM_MODEL", "local-test");
    const base = await startApi();
    expect(await (await fetch(`${base}/api/meta`)).json()).toMatchObject({ ai: true, aiStatus: "ready" });
    const result = await (
      await fetch(`${base}/api/ask`, { method: "POST", body: JSON.stringify({ text: "older men", lang: "en" }) })
    ).json();
    expect(result).toMatchObject({
      asOf: "2025-05-01",
      filters: { ward: "ICU", sex: "M", ageMin: 65, from: "2025-02-02", to: "2025-05-01" },
      ageGroup: "older",
      unmatched: ["unknown"],
    });
    expect(requests[0]?.messages[0]?.content).toContain("Teho-osasto");
    expect(requests[0]?.messages[0]?.content).toContain("2025-05-01");
    // The template by default, without asking the model (D-029).
    const plain = await (await fetch(`${base}/api/explain?id=cpe:i2&lang=en`)).json();
    expect(plain).toMatchObject({ source: "template" });
    expect(requests).toHaveLength(1);
    const en = await (await fetch(`${base}/api/explain?id=cpe:i2&lang=en&wording=model`)).json();
    expect(en).toMatchObject({ source: "model" });
    await fetch(`${base}/api/explain?id=cpe:i2&lang=en&wording=model`);
    expect(requests).toHaveLength(2);
    expect((await fetch(`${base}/api/explain?id=cpe:i2&lang=en&wording=poem`)).status).toBe(400);
    fail = true;
    expect((await fetch(`${base}/api/ask`, { method: "POST", body: JSON.stringify({ text: "anything", lang: "fi" }) })).status).toBe(502);
    // The failed question probed the model again, so meta already says it is offline (D-049).
    expect(await (await fetch(`${base}/api/meta`)).json()).toMatchObject({ ai: false, aiStatus: "offline" });
    // Cached by language: Finnish is a new request, and a failing model gives the template.
    const fallback = await (await fetch(`${base}/api/explain?id=cpe:i2&lang=fi&wording=model`)).json();
    expect(fallback.source).toBe("template");
    expect(fallback.text).toContain("Teho-osasto");
  });
  it("reports a configured model that does not answer as offline, not as available", async () => {
    // A tunnel with no origin behind it, as Cloudflare answers while the model's job is down.
    upstream = createServer((_req, res) => void res.writeHead(530).end("origin unreachable")).listen(0);
    await once(upstream, "listening");
    vi.stubEnv("AEI_LLM_URL", origin(upstream));
    vi.stubEnv("AEI_LLM_MODEL", "local-test");
    const base = await startApi();
    expect(await (await fetch(`${base}/api/meta`)).json()).toMatchObject({ ai: false, aiStatus: "offline" });
  });
});

describe("data checks", () => {
  it("reports every check passed on clean rows, and findings for implausible ingested results", async () => {
    const base = await startApi();
    const clean = await (await fetch(`${base}/api/quality`)).json();
    expect(clean).toEqual({ checked: { patients: 3, cultures: 4, isolates: 4, results: 4 }, summary: [] });
    // Klebsiella pneumoniae reported susceptible to ampicillin, which it resists by nature.
    const csv = [
      "patient_id,sex,birth_year,culture_id,sample_date,ward,specimen,organism,AMP",
      "p9,F,1950,c9,2025-05-02,ICU,urine,Klebsiella pneumoniae,S",
    ].join("\n");
    const sent = await (await fetch(`${base}/api/ingest`, { method: "POST", headers: { "content-type": "text/csv" }, body: csv })).json();
    expect(sent.accepted).toBe(1);
    expect(sent.quality.map((f: { check: string }) => f.check)).toEqual(["intrinsic-susceptible"]);
    const after = await (await fetch(`${base}/api/quality`)).json();
    expect(after.summary).toEqual([expect.objectContaining({ check: "intrinsic-susceptible", severity: "suspect", count: 1 })]);
  });
});
