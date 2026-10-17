import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoardFilters, type FilterCounts } from "./BoardFilters.tsx";

const counts: FilterCounts = { unit: new Map(), kind: new Map(), phenotype: new Map() };

describe("board filters", () => {
  it("is one toolbar button that counts the active choices", () => {
    const none = renderToStaticMarkup(
      <BoardFilters locale="en" state={{ unit: null, kinds: [], phenotype: null }} onChange={() => {}} counts={counts} />,
    );
    expect(none).toContain(">Filter<");
    const two = renderToStaticMarkup(
      <BoardFilters locale="en" state={{ unit: "MED-A", kinds: ["cluster"], phenotype: null }} onChange={() => {}} counts={counts} />,
    );
    expect(two).toContain("Filter · 2");
  });
});
