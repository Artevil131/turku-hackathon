// A self-contained SVG file of a chart on screen: the figure's computed styles are written into the copy,
// so the file looks the same outside the page (the page's stylesheet and tokens do not travel with it).

const PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
] as const;

export function standaloneSvg(svg: SVGSVGElement): string {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [copy, ...copy.querySelectorAll("*")];
  from.forEach((el, i) => {
    const style = getComputedStyle(el);
    const target = to[i] as SVGElement;
    target.setAttribute("style", PROPS.map((p) => `${p}:${style.getPropertyValue(p)}`).join(";"));
    target.removeAttribute("class");
    if (target.tagName === "title" || target.hasAttribute("data-ui")) target.remove();
  });
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.removeAttribute("style");
  const [, , w, h] = (svg.getAttribute("viewBox") ?? "0 0 480 150").split(" ");
  copy.setAttribute("width", w ?? "480");
  copy.setAttribute("height", h ?? "150");
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  copy.insertBefore(bg, copy.firstChild);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`;
}

/** The same standalone SVG drawn to a PNG at `scale` times its size (2 = crisp on a retina screen and in slides). */
export function svgToPng(svgText: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no png"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg did not load"));
    };
    img.src = url;
  });
}

/** Saves a blob under a name. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Puts a PNG on the clipboard; browsers that cannot (no ClipboardItem, or Safari outside a user gesture)
 * get the file saved instead, and the caller is told which happened.
 */
export async function copyPng(blob: Blob, fallbackName: string): Promise<"copied" | "saved"> {
  const Item = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (Item && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new Item({ "image/png": blob })]);
      return "copied";
    } catch {
      // fall through to a download
    }
  }
  saveBlob(blob, fallbackName);
  return "saved";
}
