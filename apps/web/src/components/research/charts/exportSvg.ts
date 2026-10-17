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
