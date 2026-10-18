/**
 * Brings `el` into view inside its nearest scrolling box only, never the page: scrollIntoView also scrolls every
 * ancestor up to the document, so a list that keeps its selected row in view would pull the whole page back while
 * someone is scrolling it (each refetch or clock tick). Moves the box by the least amount, along one axis.
 */
export function scrollWithin(el: Element | null | undefined, axis: "y" | "x" = "y", align: "nearest" | "center" = "nearest"): void {
  if (!el) return;
  const box = scroller(el, axis);
  if (!box) return;
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (axis === "y") {
    const delta =
      align === "center"
        ? r.top + r.height / 2 - (b.top + b.height / 2)
        : r.top < b.top
          ? r.top - b.top
          : r.bottom > b.bottom
            ? r.bottom - b.bottom
            : 0;
    if (delta) box.scrollTop += delta;
  } else {
    const delta =
      align === "center"
        ? r.left + r.width / 2 - (b.left + b.width / 2)
        : r.left < b.left
          ? r.left - b.left
          : r.right > b.right
            ? r.right - b.right
            : 0;
    if (delta) box.scrollLeft += delta;
  }
}

/** The nearest ancestor that scrolls along `axis`, stopping short of the page itself. */
function scroller(el: Element, axis: "y" | "x"): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    const overflow = axis === "y" ? style.overflowY : style.overflowX;
    const room = axis === "y" ? node.scrollHeight > node.clientHeight : node.scrollWidth > node.clientWidth;
    if (room && (overflow === "auto" || overflow === "scroll")) return node;
  }
  return null;
}
