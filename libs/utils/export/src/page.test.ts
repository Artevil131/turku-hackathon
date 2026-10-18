import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { type ExportPage, pageTablePath, toPageZip } from "./index.ts";

describe("toPageZip", () => {
  it("loads jszip on demand and zips the page's Markdown with one CSV per table", async () => {
    const table = { name: "rates", title: "Rates", columns: [{ key: "ward", label: "Unit" }], rows: [{ ward: "ICU" }] };
    const page: ExportPage = {
      title: "My page",
      asOf: "2025-05-12",
      blocks: [
        { kind: "heading", text: "Result" },
        { kind: "table", table },
      ],
    };
    const file = await toPageZip(page);
    expect(file).toMatchObject({ filename: "my-page-2025-05-12.zip", mime: "application/zip" });
    const zip = await JSZip.loadAsync(file.data as Uint8Array);
    const md = await zip.file("my-page-2025-05-12/my-page-2025-05-12.md")?.async("string");
    expect(md).toContain("## Result");
    expect(await zip.file(`my-page-2025-05-12/${pageTablePath(page, table, 1)}`)?.async("string")).toContain("ICU");
  });
});
