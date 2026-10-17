import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { notebookUrl, Reproduce, ReproduceHost } from "./Reproduce.tsx";

describe("Reproduce window", () => {
  it("offers to save the view as a project and explains the fingerprint before a project is open", () => {
    const html = renderToStaticMarkup(<Reproduce locale="en" language="python" onLanguage={vi.fn()} />);
    expect(html).toContain(
      "Save or open a project to reproduce its numbers: the same rows, checked by fingerprint, and the same methods, recomputed in Python or R.",
    );
    expect(html).toContain(">Save as project…</button>");
    expect(html).not.toContain("data-reproduce-slot");
  });
  it("renders a slot, language controls and a standalone notebook link, never an iframe in the dock", () => {
    const html = renderToStaticMarkup(
      <Reproduce locale="en" project={{ id: "a/b?", name: "Study <1>" }} language="r" onLanguage={vi.fn()} />,
    );
    expect(html).toContain("Study &lt;1&gt;");
    expect(html).toContain('aria-pressed="true">R</button>');
    expect(html).toContain("data-reproduce-slot");
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(notebookUrl("a/b?", "r"));
    expect(html).not.toContain("<iframe");
  });
  it("launches each language with JupyterLite's supported path query", () => {
    expect(new URL(notebookUrl("study", "python"), "https://example.test").searchParams.get("path")).toBe("projects/study/reproduce.ipynb");
    expect(new URL(notebookUrl("study", "r"), "https://example.test").searchParams.get("path")).toBe("projects/study/reproduce-r.ipynb");
  });
  it("uses Finnish copy and does not launch a kernel before first opening", () => {
    expect(renderToStaticMarkup(<Reproduce locale="fi" language="python" onLanguage={vi.fn()} />)).toContain("sormenjäljellä");
    expect(renderToStaticMarkup(<ReproduceHost locale="fi" projectId="study" language="python" />)).not.toContain("<iframe");
  });
});
