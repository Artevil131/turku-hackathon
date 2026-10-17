import { typingTimes } from "./fillScript.ts";
import type { Clock } from "./perform/clock.ts";

// The hands of the plain fill-in: what the player does to the DOM for one beat. Everything runs on one
// requestAnimationFrame clock (perform/clock.ts), reads the clock rather than counting frames (a slow frame skips
// ahead), touches only text nodes, data attributes and compositor-friendly styles, and puts back exactly what it found.

/** The block a text node is written in, for the caret: its paragraph, heading or list item. */
const lineOf = (node: Text, root: Element) => node.parentElement?.closest("p, h1, h2, h3, h4, h5, h6, li, pre, blockquote") ?? root;
const blockOf = (node: Text, root: Element): Element | null => {
  let el = node.parentElement;
  while (el && el.parentElement !== root) el = el.parentElement;
  return el;
};

/**
 * Types the rendered note in: its text nodes start empty and fill in character by character at `cps`, with the
 * pauses of typingTimes. Blocks not yet reached are hidden; the one being written carries the caret. At the end
 * every text node holds exactly what it held before, so React's view of the note is never contradicted.
 */
export function typeInto(root: HTMLElement, cps: number, clock: Clock): Promise<void> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; text: string; start: number; line: Element; block: Element | null; li: Element | null }[] = [];
  let start = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    if (!node.data.trim()) continue;
    nodes.push({
      node,
      text: node.data,
      start,
      line: lineOf(node, root),
      block: blockOf(node, root),
      li: node.parentElement?.closest("li") ?? null,
    });
    start += node.data.length + 1;
  }
  if (!nodes.length) return Promise.resolve();
  const times = typingTimes(nodes.map((n) => n.text).join("\n"), cps);
  const total = times.length - 1;
  for (const n of nodes) {
    n.block?.setAttribute("data-fill-pending", "");
    n.li?.setAttribute("data-fill-pending", "");
  }
  for (const n of nodes) n.node.data = "";
  const restore = () => {
    for (const n of nodes) {
      n.node.data = n.text;
      n.block?.removeAttribute("data-fill-pending");
      n.li?.removeAttribute("data-fill-pending");
      n.line.removeAttribute("data-fill-writing");
    }
  };
  return new Promise((resolve) => {
    const t0 = performance.now();
    let k = 0;
    let writing: Element | null = null;
    clock.tick((now) => {
      if (clock.stopped) {
        restore();
        resolve();
        return false;
      }
      const elapsed = (now - t0) / 1000;
      while (k < total && (times[k + 1] ?? Number.POSITIVE_INFINITY) <= elapsed) k++;
      let current = nodes[0];
      for (const n of nodes) {
        const shown = Math.max(0, Math.min(n.text.length, k - n.start));
        if (shown > 0) current = n;
        const next = n.text.slice(0, shown);
        if (n.node.data !== next) n.node.data = next;
      }
      if (current && current.line !== writing) {
        writing?.removeAttribute("data-fill-writing");
        current.block?.removeAttribute("data-fill-pending");
        current.li?.removeAttribute("data-fill-pending");
        current.line.setAttribute("data-fill-writing", "");
        writing = current.line;
      }
      if (k >= total) {
        restore();
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** The slice sentence fills in one " · " part at a time, `each` ms apart; the text node ends as it began. */
export async function placeInto(sentence: HTMLElement, each: number, clock: Clock): Promise<void> {
  const node = sentence.firstChild;
  if (!(node instanceof Text)) return;
  const text = node.data;
  const parts = text.split(" · ");
  for (let i = 1; i <= parts.length; i++) {
    if (clock.stopped) break;
    node.data = parts.slice(0, i).join(" · ");
    await clock.wait(each);
  }
  node.data = text;
}

const NUM = /^([−-]?)(\d+)(?:([.,])(\d+))?( ?%)?$/;

/** The plain numbers under `root` (a result's figures) count up from zero over `ms`, keeping their own format. */
export function countUp(root: Element, ms: number, clock: Clock): void {
  const items: { node: Text; text: string; sign: string; value: number; sep: string; decimals: number; suffix: string }[] = [];
  for (const el of root.querySelectorAll(".tl-nums b, .answer-figures dd")) {
    const node = el.firstChild;
    if (!(node instanceof Text) || el.childNodes.length !== 1) continue;
    const m = NUM.exec(node.data.trim());
    if (!m) continue;
    const decimals = m[4]?.length ?? 0;
    items.push({
      node,
      text: node.data,
      sign: m[1] ?? "",
      value: Number(`${m[2]}.${m[4] ?? "0"}`),
      sep: m[3] ?? ".",
      decimals,
      suffix: m[5] ?? "",
    });
  }
  if (!items.length) return;
  const t0 = performance.now();
  clock.tick((now) => {
    const p = Math.min(1, (now - t0) / ms);
    const e = 1 - (1 - p) ** 3;
    for (const it of items) {
      it.node.data =
        p >= 1 || clock.stopped ? it.text : `${it.sign}${(it.value * e).toFixed(it.decimals).replace(".", it.sep)}${it.suffix}`;
    }
    return p < 1 && !clock.stopped;
  });
}

/** The chart's lines draw themselves over `ms`: dash offset from their length to zero, dots and band after. */
export function drawLines(cell: HTMLElement, ms: number, ease: string): () => void {
  const lines = [...cell.querySelectorAll<SVGGeometryElement>(".ch-line")];
  const lengths = lines.map((l) => l.getTotalLength());
  lines.forEach((line, i) => {
    const len = `${lengths[i] ?? 0}`;
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.style.transition = "none";
  });
  cell.style.setProperty("--fill-for", `${ms}ms`);
  cell.style.setProperty("--fill-ease", ease);
  cell.setAttribute("data-fill-drawing", "");
  // The start state is committed first; the next frame glides to the end state.
  requestAnimationFrame(() => {
    for (const line of lines) {
      line.style.transition = `stroke-dashoffset ${ms}ms ${ease}`;
      line.style.strokeDashoffset = "0";
    }
  });
  return () => {
    for (const line of lines) line.removeAttribute("style");
    cell.removeAttribute("data-fill-drawing");
  };
}

/** Presses a control as a person would: a short pressed look, then the click (or the value, for a select or input). */
export async function press(el: HTMLElement, value: string | undefined, clock: Clock): Promise<void> {
  el.setAttribute("data-fill-pressed", "");
  await clock.wait(140);
  if (!clock.stopped) {
    if (value !== undefined && (el instanceof HTMLSelectElement || el instanceof HTMLInputElement)) {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    } else el.click();
    await clock.wait(120);
  }
  el.removeAttribute("data-fill-pressed");
}

/** Every mark the fill left in the DOM, gone. */
export function sweep(root: ParentNode): void {
  const attrs = [
    "data-fill-pending",
    "data-fill-writing",
    "data-fill-pressed",
    "data-fill-active",
    "data-fill-done",
    "data-fill-placing",
    "data-fill-result",
    "data-fill-drawing",
    "data-fill-veil",
    "data-fill-how",
  ];
  for (const el of root.querySelectorAll<HTMLElement>(attrs.map((a) => `[${a}]`).join(","))) {
    for (const a of attrs) el.removeAttribute(a);
    el.style.removeProperty("--fill-for");
    el.style.removeProperty("--fill-ease");
  }
  for (const line of root.querySelectorAll<SVGElement>(".ch-line[style]")) line.removeAttribute("style");
}
