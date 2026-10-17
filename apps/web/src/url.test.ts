import { describe, expect, it } from "vitest";
import { mergeHash } from "./url.ts";

describe("mergeHash", () => {
  it("sets and removes params on the page, keeping the shared ones", () => {
    expect(mergeHash("#research?unit=URO&tl=abc&hospital=sata", { inc: "x:1", unit: null })).toBe(
      "#research?inc=x%3A1&tl=abc&hospital=sata",
    );
  });
  it("keeps the chosen weeks when a page writes its own params", () => {
    expect(mergeHash("#research?focus=ED&from=2024-02-26&to=2024-03-10", { focus: "URO" })).toBe(
      "#research?focus=URO&from=2024-02-26&to=2024-03-10",
    );
  });
  it("drops empty values and leaves no query when nothing is left", () => {
    expect(mergeHash("#doctor?unit=ED", { unit: "" })).toBe("#doctor");
    expect(mergeHash("research", {})).toBe("#research");
  });
  it("lets a caller replace a shared param by naming it", () => {
    expect(mergeHash("#research?tl=abc", { tl: "def" })).toBe("#research?tl=def");
    expect(mergeHash("#research?tl=abc", { tl: null })).toBe("#research");
  });
});
