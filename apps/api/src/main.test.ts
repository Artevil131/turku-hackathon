import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    expect((await (await fetch(`${base}/api/meta`)).json()).ai).toBe(false);
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
    expect((await (await fetch(`${base}/api/meta`)).json()).ai).toBe(true);
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
    // Cached by language: Finnish is a new request, and a failing model gives the template.
    const fallback = await (await fetch(`${base}/api/explain?id=cpe:i2&lang=fi&wording=model`)).json();
    expect(fallback.source).toBe("template");
    expect(fallback.text).toContain("Teho-osasto");
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
