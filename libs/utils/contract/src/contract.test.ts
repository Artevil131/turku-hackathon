import { describe, expect, it } from "vitest";
import { ApiError, createAeiClient, isolatesUrl } from "./index.ts";

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
