import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.ts";

describe("parseCsv", () => {
  it("reads header rows, empty fields and CRLF", () => {
    expect(parseCsv("a,b,c\r\n1,,3\r\n")).toEqual([{ a: "1", b: "", c: "3" }]);
  });

  it("handles quotes, escaped quotes and commas inside quotes", () => {
    expect(parseCsv('name,class\n"a, b","say ""hi"""\n')).toEqual([{ name: "a, b", class: 'say "hi"' }]);
  });

  it("strips a BOM and tolerates a missing final newline", () => {
    expect(parseCsv("﻿x\n1")).toEqual([{ x: "1" }]);
  });
});
