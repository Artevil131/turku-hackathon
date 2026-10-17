import { afterEach, describe, expect, it, vi } from "vitest";
import { rasterizeSvg, serializeSvg } from "./dom.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

class SvgElement {
  attributes: Record<string, string> = {};
  styles: Record<string, string> = {};
  style = {
    setProperty: (key: string, value: string) => {
      this.styles[key] = value;
    },
  };
  children: SvgElement[] = [];
  viewBox = { baseVal: { width: 120, height: 60 } };
  width = { baseVal: { value: 120 } };
  height = { baseVal: { value: 60 } };
  querySelectorAll() {
    return this.children;
  }
  getBoundingClientRect() {
    return { width: 240, height: 120 };
  }
  setAttribute(key: string, value: string) {
    this.attributes[key] = value;
  }
  hasAttribute(key: string) {
    return key in this.attributes;
  }
  cloneNode(): SvgElement {
    const clone = new SvgElement();
    clone.attributes = { ...this.attributes };
    clone.children = this.children.map((child) => child.cloneNode());
    return clone;
  }
}

describe("SVG browser helpers", () => {
  it("inlines computed chart styles on a clone and supplies standalone dimensions", () => {
    vi.stubGlobal("SVGElement", SvgElement);
    vi.stubGlobal("getComputedStyle", () => ({
      getPropertyValue: (property: string) => (property === "fill" ? "rgb(1, 2, 3)" : property === "font-size" ? "12px" : "initial"),
    }));
    let serialized: SvgElement | undefined;
    vi.stubGlobal(
      "XMLSerializer",
      class {
        serializeToString(svg: SvgElement) {
          serialized = svg;
          return "serialized svg";
        }
      },
    );
    const original = new SvgElement();
    original.children.push(new SvgElement());
    expect(serializeSvg(original as unknown as SVGSVGElement)).toBe("serialized svg");
    expect(serialized?.attributes).toMatchObject({
      xmlns: "http://www.w3.org/2000/svg",
      width: "240",
      height: "120",
      viewBox: "0 0 240 120",
    });
    expect(serialized?.children[0]?.styles).toMatchObject({ fill: "rgb(1, 2, 3)", "font-size": "12px" });
    expect(original.attributes).toEqual({});
    expect(original.children[0]?.styles).toEqual({});
    original.attributes.viewBox = "0 0 120 60";
    serializeSvg(original as unknown as SVGSVGElement);
    expect(serialized?.attributes.viewBox).toBe("0 0 120 60");
  });

  function browser(png: Blob | null = new Blob([new Uint8Array([1, 2, 3])])) {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:svg");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal(
      "Image",
      class {
        onload?: () => void;
        set src(_value: string) {
          this.onload?.();
        }
      },
    );
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: (blob: Blob | null) => void) => callback(png),
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    return { create, revoke, canvas, drawImage };
  }
  it("rasterises at twice the requested dimensions and revokes its temporary URL", async () => {
    const { revoke, canvas, drawImage } = browser();
    const png = await rasterizeSvg("<svg />", 120, 60);
    expect(png).toEqual({ bytes: new Uint8Array([1, 2, 3]), width: 240, height: 120 });
    expect(canvas).toMatchObject({ width: 240, height: 120 });
    expect(drawImage).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:svg");
  });
  it("reports PNG failures and still revokes the URL", async () => {
    const { revoke } = browser(null);
    await expect(rasterizeSvg("<svg />", 120, 60)).rejects.toThrow("PNG encoding failed");
    expect(revoke).toHaveBeenCalledWith("blob:svg");
  });
  it("rejects invalid dimensions before allocating browser resources", async () => {
    await expect(rasterizeSvg("<svg />", 0, 60)).rejects.toThrow("Invalid raster dimensions");
    await expect(rasterizeSvg("<svg />", 120, 60, Number.NaN)).rejects.toThrow("Invalid raster dimensions");
  });
});
