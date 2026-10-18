import { describe, expect, it } from "vitest";
import { DEFAULT_LAYERS, decodeLayers, encodeLayers } from "./layers.ts";

describe("layers code", () => {
  it("is empty for the defaults: the last year, data-problem pills off", () => {
    expect(DEFAULT_LAYERS.window).toBe(52);
    expect(DEFAULT_LAYERS.kinds.data).toBe(false);
    expect(encodeLayers(DEFAULT_LAYERS)).toBe("");
    expect(decodeLayers("")).toEqual(DEFAULT_LAYERS);
  });

  it("writes the whole history and the data pills back on, and reads them again", () => {
    const l = { ...DEFAULT_LAYERS, window: 0 as const, kinds: { ...DEFAULT_LAYERS.kinds, data: true, trend: false } };
    const code = encodeLayers(l);
    expect(code).toBe("w0.-k:trend.+k:data");
    expect(decodeLayers(code)).toEqual(l);
  });
});
