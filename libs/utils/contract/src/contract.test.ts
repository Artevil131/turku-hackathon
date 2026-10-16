import { describe, expect, it } from "vitest";
import { isolatesUrl } from "./index.ts";

describe("isolatesUrl", () => {
  it("drops empty filters", () => {
    expect(isolatesUrl({})).toBe("/api/isolates");
    expect(isolatesUrl({ ward: "ICU", specimen: undefined, from: "2026-09-01" })).toBe("/api/isolates?ward=ICU&from=2026-09-01");
  });
});
