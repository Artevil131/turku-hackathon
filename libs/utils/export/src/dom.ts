import type { ExportFigure } from "./bundle.ts";

const STYLE_PROPERTIES = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "fill-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "color",
] as const;

/** Clone, never mutate the live chart. Resolve inherited page styles before serialising. */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((element, index) => {
    const copy = copies[index];
    if (!(copy instanceof SVGElement)) return;
    const computed = getComputedStyle(element);
    for (const property of STYLE_PROPERTIES) copy.style.setProperty(property, computed.getPropertyValue(property));
  });
  const box = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const width = box.width || svg.width.baseVal.value || viewBox.width;
  const height = box.height || svg.height.baseVal.value || viewBox.height;
  if (!(width > 0 && height > 0)) throw new Error("SVG has no positive dimensions");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.hasAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  return new XMLSerializer().serializeToString(clone);
}

export async function rasterizeSvg(svgText: string, width: number, height: number, scale = 2): Promise<NonNullable<ExportFigure["png"]>> {
  if (![width, height, scale].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Invalid raster dimensions");
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SVG image could not be loaded"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("PNG encoding failed"))), "image/png"),
    );
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
