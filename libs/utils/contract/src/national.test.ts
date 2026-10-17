import { ORGANISMS } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { createAeiClient, FINRES_GENUS, type NationalResponse, nationalCell, ROUTES } from "./index.ts";

const response: NationalResponse = {
  source: "THL Finres",
  licence: "CC BY 4.0",
  fetched: "2026-10-17",
  year: 2025,
  cells: [
    { genus: "Escherichia", antibiotic: "CIP", specimen: "urine", tests: 89634, resistant: 6595, pctR: 7.4, interval: [7.2, 7.5] },
    { genus: "Escherichia", antibiotic: "TMP", specimen: "blood", tests: 1616, resistant: null, pctR: null, interval: null },
    { genus: "Klebsiella", antibiotic: "CIP", specimen: "urine", tests: 18068, resistant: 1005, pctR: 5.6, interval: [5.2, 5.9] },
    { genus: "Staphylococcus", antibiotic: "MRSA", specimen: "blood", tests: 2339, resistant: 85, pctR: 3.6, interval: [2.9, 4.5] },
  ],
};

describe("nationalCell", () => {
  it("maps species to the Finres genus", () => {
    expect(nationalCell(response, "Escherichia coli", "CIP", "urine")?.pctR).toBe(7.4);
    expect(nationalCell(response, "Klebsiella oxytoca", "CIP", "urine")?.pctR).toBe(5.6);
    expect(nationalCell(response, "Klebsiella pneumoniae", "CIP", "urine")?.tests).toBe(18068);
  });

  it("reads the cefoxitin screen as the MRSA flag", () => {
    expect(nationalCell(response, "Staphylococcus aureus", "FOX", "blood")?.antibiotic).toBe("MRSA");
    expect(nationalCell(response, "Staphylococcus aureus", "MRSA", "blood")?.pctR).toBe(3.6);
  });

  it("returns the cell with nulls when the cube has no %R, and nothing when there is no cell or genus", () => {
    expect(nationalCell(response, "Escherichia coli", "TMP", "blood")?.pctR).toBeNull();
    expect(nationalCell(response, "Escherichia coli", "CIP", "wound")).toBeUndefined();
    expect(nationalCell(response, "Proteus mirabilis", "CIP", "urine")).toBeUndefined();
    expect(nationalCell(response, "Staphylococcus saprophyticus", "FOX", "urine")).toBeUndefined();
  });

  it("covers six of the dataset's species", () => {
    expect(ORGANISMS.filter((o) => FINRES_GENUS[o])).toHaveLength(6);
  });
});

it("fetches the national route", async () => {
  const requests: string[] = [];
  const client = createAeiClient({
    baseUrl: "",
    fetch: async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify(response), { status: 200 });
    },
  });
  expect((await client.national()).year).toBe(2025);
  expect(requests).toEqual([ROUTES.national]);
  expect(ROUTES.national).toBe("/api/national");
});
