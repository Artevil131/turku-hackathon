import { describe, expect, it } from "vitest";
import { connectSnippet, notebookHref } from "./notebook.ts";

describe("notebook links", () => {
  it("opens the project's notebook in the served site", () => {
    expect(notebookHref("abc-1")).toBe("/notebook/lab/index.html?path=projects%2Fabc-1%2Freproduce.ipynb");
  });

  it("gives the connect line for the open project, or a placeholder without one", () => {
    expect(connectSnippet("https://aei.example", "abc-1")).toBe('aei.connect("https://aei.example/api").project("abc-1")');
    expect(connectSnippet("https://aei.example", null)).toBe('aei.connect("https://aei.example/api").project("PROJECT_ID")');
  });
});
