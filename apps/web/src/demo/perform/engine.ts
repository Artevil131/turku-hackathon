import { typingTimes } from "../fillScript.ts";
import type { Clock } from "./clock.ts";
import type { Target } from "./script.ts";

// The hands of a performance: finding things on the real screen, pressing them, typing into them, dragging across
// a band. Every wait runs on the one clock; nothing here renders React.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const resolveTarget = (target: Target): Element | null => (typeof target === "function" ? target() : document.querySelector(target));

/**
 * Where an element shows on screen: its box cut to every scrolling or clipping ancestor, so something scrolled out
 * of its window gives null instead of a point floating over something else. (As the guided tour measures.)
 */
export function boxOf(el: Element | null): Box | null {
  if (!el?.isConnected || el.closest("[inert], [hidden], [aria-hidden='true']")) return null;
  const r = el.getBoundingClientRect();
  let [x0, y0, x1, y1] = [r.left, r.top, r.right, r.bottom];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p);
    if (o.overflowX === "visible" && o.overflowY === "visible") continue;
    const c = p.getBoundingClientRect();
    [x0, y0, x1, y1] = [Math.max(x0, c.left), Math.max(y0, c.top), Math.min(x1, c.right), Math.min(y1, c.bottom)];
  }
  [x0, y0, x1, y1] = [Math.max(x0, 0), Math.max(y0, 0), Math.min(x1, innerWidth), Math.min(y1, innerHeight)];
  return x1 - x0 < 4 || y1 - y0 < 4 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Waits for a target: by default one that is on screen (scrolling it into its pane if it is there but out of view);
 * with `visible` false, one that merely exists (a result that has arrived, wherever the page put it).
 */
export function until(target: Target, ms: number, clock: Clock, visible = true): Promise<Element | null> {
  let lastScroll = 0;
  return clock.waitFor(() => {
    const el = resolveTarget(target);
    if (el && (!visible || boxOf(el))) return el;
    // Out of view: bring it in, and again a moment later if the layout grew under it (a result arriving pushes it down).
    const now = performance.now();
    if (el?.isConnected && now - lastScroll > 200 && !el.closest("[inert], [hidden]")) {
      lastScroll = now;
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    }
    return null;
  }, ms);
}

/** A click as the element's own handler expects it: HTML elements have click(); an SVG pill gets the event itself. */
export function fire(el: Element): void {
  if (el instanceof HTMLElement) el.click();
  else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
}

type Field = HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement;
const isField = (el: Element | null): el is Field =>
  el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement;

/** Sets a React-controlled field's value the way a person's input would: the native setter, then the event React listens for. */
export function setValue(el: Field, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

/**
 * Types `text` into a field at `cps`, with the pauses of typingTimes: the field's text advances every frame
 * (a native write, no render), and React is told about it a few times a second and at the end. Then the field is left.
 */
export function typeText(el: Element | null, text: string, cps: number, clock: Clock): Promise<boolean> {
  if (!isField(el) || el instanceof HTMLSelectElement) return Promise.resolve(false);
  const field = el;
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const write = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const base = field.value;
  field.focus();
  const times = typingTimes(text, cps);
  const total = text.length;
  return new Promise((resolve) => {
    let t0 = performance.now();
    let k = 0;
    let flushed = t0;
    clock.tick((now) => {
      if (clock.stopped) {
        setValue(field, base + text);
        resolve(true);
        return false;
      }
      const elapsed = (now - t0) / 1000;
      let moved = false;
      // At most two characters a frame: after a slow frame the typing carries on rather than catching up in a burst.
      for (let n = 0; n < 8 && k < total && (times[k + 1] ?? Number.POSITIVE_INFINITY) <= elapsed; n++) {
        k++;
        moved = true;
      }
      if (k < total && (times[k + 1] ?? Number.POSITIVE_INFINITY) <= elapsed) t0 = now - (times[k] ?? 0) * 1000;
      const next = base + text.slice(0, k);
      // A render of React's own could put the field back to what it last heard: the typed text is kept up every frame.
      if (moved || field.value !== next) {
        if (k >= total || now - flushed > 160) {
          setValue(field, next);
          flushed = now;
        } else {
          write?.call(field, next);
          field.scrollTop = field.scrollHeight;
        }
      }
      if (k >= total) {
        leave(field);
        resolve(true);
        return false;
      }
      return true;
    });
  });
}

/** Leaves a field as a person would: focus goes, and the field hears it even when the page itself has no focus. */
function leave(field: Field): void {
  field.blur();
  field.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    pointerId: 7,
    pointerType: "mouse",
    isPrimary: true,
  });

/** How many weeks a band shows, read off its pills' week numbers (the latest pill sits in or near the clock's week). */
export function bandWeeks(svg: Element | null): number | null {
  let max = -1;
  for (const p of svg?.querySelectorAll("[data-week]") ?? []) max = Math.max(max, Number(p.getAttribute("data-week")));
  return max >= 0 ? max + 1 : null;
}

/**
 * Drags across a weekly band's plot from one fraction to another (0 the first week, 1 the clock), the way the
 * band's own range handler expects: pointerdown on its svg above the lanes, pointermoves on the window, pointerup.
 * `follow` gets each position so the drawn cursor can ride along. Resolves false when the svg has no band.
 */
export function dragBand(
  svg: Element | null,
  from: number,
  to: number,
  ms: number,
  clock: Clock,
  follow: (x: number, y: number) => void,
): Promise<boolean> {
  const base = svg instanceof SVGSVGElement ? svg.querySelector<SVGLineElement>(".hs-base") : null;
  if (!base || !(svg instanceof SVGSVGElement)) return Promise.resolve(false);
  const ctm = svg.getScreenCTM();
  if (!ctm) return Promise.resolve(false);
  const x1 = base.x1.baseVal.value;
  const x2 = base.x2.baseVal.value;
  const at = (f: number) => new DOMPoint(x1 + (x2 - x1) * f, base.y1.baseVal.value - 10).matrixTransform(ctm);
  const a = at(from);
  const b = at(to);
  follow(a.x, a.y);
  svg.dispatchEvent(pointer("pointerdown", a.x, a.y));
  return new Promise((resolve) => {
    const t0 = performance.now();
    clock.tick((now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const x = a.x + (b.x - a.x) * e;
      window.dispatchEvent(pointer("pointermove", x, a.y));
      follow(x, a.y);
      if (p >= 1 || clock.stopped) {
        window.dispatchEvent(pointer("pointerup", x, a.y));
        resolve(true);
        return false;
      }
      return true;
    });
  });
}
