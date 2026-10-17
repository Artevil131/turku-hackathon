import { describe, expect, it } from "vitest";
import { ApiError, createAeiClient, isolatesUrl, type RegionalData, regionalUpTo } from "./index.ts";

describe("isolatesUrl", () => {
  it("drops empty filters", () => {
    expect(isolatesUrl({})).toBe("/api/isolates");
    expect(isolatesUrl({ ward: "ICU", specimen: undefined, from: "2026-09-01" })).toBe("/api/isolates?ward=ICU&from=2026-09-01");
  });
});

it("serialises age zero and sex", () => {
  expect(isolatesUrl({ ageMin: 0, ageMax: 0, sex: "F" })).toBe("/api/isolates?ageMin=0&ageMax=0&sex=F");
});
it("posts questions and encodes explanation identifiers", async () => {
  const requests: [string, RequestInit | undefined][] = [];
  const client = createAeiClient({
    baseUrl: "",
    fetch: async (input, init) => {
      requests.push([String(input), init]);
      return new Response("{}", { status: 200 });
    },
  });
  await client.ask("older men", "en");
  await client.explain("carrier:c:esbl", "fi");
  expect(requests[0]).toEqual([
    "/api/ask",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "older men", lang: "en" }) },
  ]);
  expect(requests[1]?.[0]).toBe("/api/explain?id=carrier%3Ac%3Aesbl&lang=fi");
});
it("exposes HTTP status to clients", async () => {
  const client = createAeiClient({ baseUrl: "", fetch: async () => new Response("disabled", { status: 503 }) });
  await expect(client.ask("question", "en")).rejects.toMatchObject({ status: 503, name: "ApiError" });
  expect(new ApiError(502, "unavailable")).toBeInstanceOf(Error);
});

describe("regionalUpTo", () => {
  const data: RegionalData = {
    source: "THL",
    fetched: "2026-10-16",
    settings: {
      firstTarget: "2024-01",
      baseline: 36,
      alpha: 0.001,
      minCases: 5,
      familyAlpha: 0.05,
      testedSeriesMonths: 8,
      forecastMethod: "0020 R1 phenotype totals, D-045",
    },
    months: ["2025-07", "2025-08", "2025-09", "2025-10"],
    groups: ["CPE carriage, E. coli", "MRSA carriage"],
    regions: ["Varsinais-Suomen hyvinvointialue", "Finland (all counties)"],
    series: [
      {
        group: "CPE carriage, E. coli",
        region: "Varsinais-Suomen hyvinvointialue",
        cases: [1, 3, 8, 3],
        incidencePer100k: [0.2, 0.6, 1.7, 0.6],
      },
      { group: "MRSA carriage", region: "Finland (all counties)", cases: [150, 160, 170, 140], incidencePer100k: null },
    ],
    forecasts: [
      {
        phenotype: "CPE",
        region: "Varsinais-Suomen hyvinvointialue",
        month: "2025-11",
        mean: 3.2,
        low: 0,
        high: 8,
        level: 0.9,
      },
      { phenotype: "MRSA", region: "Finland (all counties)", month: "2025-11", mean: 155, low: 135, high: 176, level: 0.9 },
    ],
    signals: [
      {
        group: "CPE carriage, E. coli",
        region: "Varsinais-Suomen hyvinvointialue",
        month: "2025-09",
        cases: 8,
        expected: 0.6,
        dispersion: 1,
        p: 1.7e-7,
        strong: true,
      },
    ],
  };

  it("shows only months that ended before the clock", () => {
    const during = regionalUpTo(data, "2025-09-20");
    expect(during.months).toEqual(["2025-07", "2025-08"]);
    expect(during.series[0]?.cases).toEqual([1, 3]);
    expect(during.series[1]?.incidencePer100k).toBeNull();
    expect(during.signals).toEqual([]);
    expect(regionalUpTo(data, "2025-10-01").signals).toHaveLength(1);
  });

  it("hides latest-fit forecasts on earlier replay cuts, including before any observed month", () => {
    expect(regionalUpTo(data, "2025-07-01").forecasts).toEqual([]);
    expect(regionalUpTo(data, "2025-10-31").forecasts).toEqual([]);
    expect(regionalUpTo(data, "2025-11-01").forecasts).toEqual(data.forecasts);
    expect(regionalUpTo(data, "2026-01-01").forecasts).toEqual(data.forecasts);
  });

  it("matches the forecast to the month after the cut across a year boundary", () => {
    const december = { ...data, months: ["2025-12"], forecasts: data.forecasts.map((f) => ({ ...f, month: "2026-01" })) };
    expect(regionalUpTo(december, "2026-01-01").forecasts).toEqual(december.forecasts);
    expect(regionalUpTo(december, "2025-12-31").forecasts).toEqual([]);
  });

  it("accepts old regional files without forecasts", () => {
    const { forecasts: _, ...old } = data;
    expect(regionalUpTo(old as RegionalData, "2026-01-01").forecasts).toEqual([]);
  });

  it("returns the rolling-origin forecast at a 2025 replay clock, not later origins", () => {
    const historical = {
      phenotype: "CPE" as const,
      region: "Varsinais-Suomen hyvinvointialue",
      month: "2025-09",
      mean: 2.5,
      low: 0,
      high: 6,
      level: 0.9,
    };
    const rolling = { ...data, forecasts: [...data.forecasts, historical] };
    const shown = regionalUpTo(rolling, "2025-09-20", { region: historical.region });
    expect(shown.months.at(-1)).toBe("2025-08");
    expect(shown.forecasts).toEqual([historical]);
  });

  it("filters series, signals and forecasts but keeps the lists whole", () => {
    const r = regionalUpTo(data, "2026-01-01", { group: "MRSA carriage" });
    expect(r.series.map((s) => s.group)).toEqual(["MRSA carriage"]);
    expect(r.signals).toEqual([]);
    expect(r.forecasts.map((f) => f.phenotype)).toEqual(["MRSA"]);
    expect(regionalUpTo(data, "2026-01-01", { region: "Varsinais-Suomen hyvinvointialue" }).forecasts).toEqual([data.forecasts[0]]);
    expect(regionalUpTo(data, "2026-01-01", { group: "MRSA blood/CSF" }).forecasts).toEqual(r.forecasts);
    expect(regionalUpTo(data, "2026-01-01", { group: "VRE carriage" }).forecasts).toEqual([]);
    expect(r.groups).toHaveLength(2);
  });
});
