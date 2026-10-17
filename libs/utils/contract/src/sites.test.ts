import { describe, expect, it } from "vitest";
import { createAeiClient, isolatesUrl, ROUTES, type SitesResponse } from "./index.ts";

// The sites route and the site filters (D-051), additive to the contract.

describe("sites in the contract", () => {
  const requests: string[] = [];
  const body: SitesResponse = { asOf: "2025-06-01", sites: [] };
  const client = createAeiClient({
    baseUrl: "",
    fetch: async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify(body), { status: 200 });
    },
  });

  it("reads the sites route", async () => {
    expect(ROUTES.sites).toBe("/api/sites");
    await expect(client.sites()).resolves.toEqual(body);
    expect(requests.at(-1)).toBe("/api/sites");
  });

  it("sends results with the site's token and returns a refusal with its status", async () => {
    const seen: [string, RequestInit | undefined][] = [];
    const ingesting = createAeiClient({
      baseUrl: "",
      fetch: async (input, init) => {
        seen.push([String(input), init]);
        return new Response(JSON.stringify({ error: "unknown token" }), { status: 401 });
      },
    });
    await expect(ingesting.ingest("MSH|...", "x-application/hl7-v2+er7", "t0k")).resolves.toEqual({
      status: 401,
      body: { error: "unknown token" },
    });
    expect(seen[0]?.[0]).toBe("/api/ingest");
    expect(seen[0]?.[1]?.headers).toEqual({ "content-type": "x-application/hl7-v2+er7", authorization: "Bearer t0k" });
  });

  it("passes site filters on every per-site query", async () => {
    expect(isolatesUrl({ site: "sata", ward: "sata/ICU" })).toBe("/api/isolates?site=sata&ward=sata%2FICU");
    await client.alerts({ site: "sata" });
    await client.relations({ days: 28, site: "sata" });
    await client.weekly({ site: "sata" });
    await client.quality({ site: "sata" });
    await client.quality();
    await client.coverage({ ward: "ICU", site: "sata", specimen: "urine" });
    expect(requests.slice(-6)).toEqual([
      "/api/alerts?site=sata",
      "/api/relations?days=28&site=sata",
      "/api/weekly?site=sata",
      "/api/quality?site=sata",
      "/api/quality",
      "/api/coverage?ward=ICU&site=sata&specimen=urine",
    ]);
  });
});
