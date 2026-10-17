import type { AeiClient } from "@aei/contract";
import { registry } from "@aei/methods";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataPage } from "./DataPage.tsx";

const client = {} as AeiClient;
const at = (hash: string) => vi.stubGlobal("location", { hash });

describe("Data page", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("has one heading and four sections, the chosen one from the URL", () => {
    at("#data?section=own");
    for (const [locale, own, add] of [
      ["en", "Your own data", "Add table…"],
      ["fi", "Oma aineisto", "Lisää taulukko…"],
    ] as const) {
      const html = renderToStaticMarkup(<DataPage client={client} liveClient={client} locale={locale} asOf={null} />);
      expect(html.match(/<h1/g)).toHaveLength(1);
      expect(html.match(/role="tab"/g)).toHaveLength(4);
      expect(html).toMatch(/id="data-tab-own" aria-selected="true"/);
      expect(html).toContain(own);
      // Own data stays in the browser and is not built yet: the button says so instead of failing.
      expect(html).toMatch(new RegExp(`disabled="" aria-describedby="data-own-soon">${add}`));
    }
  });
  it("lists every registered method in the Methods section, without a second page heading", () => {
    at("#data?section=methods");
    const html = renderToStaticMarkup(<DataPage client={client} liveClient={client} locale="en" asOf={null} />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).not.toContain("<main");
    for (const method of registry) expect(html).toContain(`id="method-${method.id}"`);
  });
});
