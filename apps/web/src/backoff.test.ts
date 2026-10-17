import { describe, expect, it } from "vitest";
import { backoffDelay } from "./backoff.ts";

describe("backoffDelay", () => {
  it("doubles from the base and stops at the cap", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n))).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
  it("treats negative and huge attempts safely", () => {
    expect(backoffDelay(-3)).toBe(2000);
    expect(backoffDelay(1e9)).toBe(30000);
  });
});
