import type { Clock } from "./clock.ts";

// The drawn hand: the cursor element, moved by transform alone on the one clock. It travels like a hand does: a
// Fitts-like time for the distance, a slightly arched path, speed peaking mid-way, a small overshoot that settles,
// a faint tremor while it rests, a slow drift while it reads. Its destination is live: an `Aim` is asked again every
// frame, so a target that scrolls or is pushed down by a result arriving is still where the hand ends up, and once
// there the hand stays on it (anchored) while the page moves under it.

export interface HandPace {
  /** The shortest and longest travel, ms. A move takes `min + 55 · log2(distance / 16 + 1)`, capped at `max`. */
  min: number;
  max: number;
}

export interface Point {
  x: number;
  y: number;
}
/** A place on screen, or a function that says where it is now (null: it is gone, keep the last place). */
export type Aim = Point | (() => Point | null);

export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const resolve = (aim: Aim) => (typeof aim === "function" ? aim() : aim);
const smooth = (p: number) => {
  const q = Math.min(1, Math.max(0, p));
  return q * q * (3 - 2 * q);
};

// ---------- the paths, as pure geometry (tested on their own) ----------

/**
 * Where a hand travelling from `from` to `to` is at progress `p` (0 to 1): the straight line eased in and out, bowed to
 * one side by `bowK` of the distance (a hand swings, it does not rule a line), with a small overshoot past the target in
 * the last third that settles back onto it.
 */
export function arcPoint(from: Point, to: Point, p: number, bowK: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const u = easeInOut(p);
  const over = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.7) / 0.3))) * Math.min(5, 1.5 + dist * 0.008);
  const bow = Math.sin(Math.PI * u) * dist * bowK;
  return {
    x: from.x + dx * u + (dx / dist) * over - (dy / dist) * bow,
    y: from.y + dy * u + (dy / dist) * over + (dx / dist) * bow,
  };
}

export interface Orbit {
  /** The point the hand rests on before and after (on the object). */
  rest: Point;
  /** The object's centre and the half-axes of the loop around it. */
  centre: Point;
  rx: number;
  ry: number;
  /** Full turns, and the direction (1 clockwise on screen, -1 the other way). */
  turns: number;
  dir: 1 | -1;
}

/**
 * Where a hand scanning an object is at progress `p` (0 to 1): it leaves its resting point, spirals out onto an ellipse
 * around the object's centre, goes round `turns` times (fast in the middle, slow at the ends), then spirals back in and
 * settles on the resting point. One continuous path, nothing jumps.
 */
export function orbitPoint(o: Orbit, p: number): Point {
  const q = Math.min(1, Math.max(0, p));
  // Out over the first fifth, in over the last fifth; full radius between.
  const f = smooth(q / 0.2) * (1 - smooth((q - 0.8) / 0.2));
  const a0 = Math.atan2(o.rest.y - o.centre.y, o.rest.x - o.centre.x);
  const a = a0 + o.dir * o.turns * 2 * Math.PI * easeInOut(q);
  return {
    x: o.rest.x + (o.centre.x - o.rest.x) * f + o.rx * f * Math.cos(a),
    y: o.rest.y + (o.centre.y - o.rest.y) * f + o.ry * f * Math.sin(a),
  };
}

export class Hand {
  x: number;
  y: number;
  /** While held (a drag, a travel) the hand does not tremble or follow its anchor. */
  private held = false;
  /** Where the hand stays once it has arrived: asked every frame, the hand glides after it. */
  private anchor: (() => Point | null) | null = null;
  private busy = false;
  private seed = 7;
  private el: HTMLElement;
  private clock: Clock;
  constructor(el: HTMLElement, clock: Clock, x: number, y: number) {
    this.el = el;
    this.clock = clock;
    this.x = x;
    this.y = y;
    this.write(x, y);
    this.clock.tick((now) => {
      if (!this.held && this.el.hasAttribute("data-shown")) {
        const p = this.anchor?.();
        if (p) {
          // Glides after a moving anchor; at rest the gap is zero.
          const k = 0.4;
          this.x += (p.x - this.x) * k;
          this.y += (p.y - this.y) * k;
        }
        const t = now / 1000;
        // Waiting on the app: the hand circles a little on the spot, so the show is visibly alive, not stuck.
        const r = this.busy ? 7 : 0;
        this.write(
          this.x + Math.sin(t * 2.1) * 0.45 + Math.sin(t * 5.3) * 0.2 + Math.cos(t * 4.2) * r,
          this.y + Math.cos(t * 1.7) * 0.45 + Math.sin(t * 4.3) * 0.2 + Math.sin(t * 4.2) * r,
        );
      }
      return !this.clock.stopped;
    });
  }
  private noise() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
  private write(x: number, y: number) {
    this.el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
  }
  show() {
    this.el.setAttribute("data-shown", "");
  }
  hide() {
    this.el.removeAttribute("data-shown");
  }
  /** Circles on the spot while the app works (a result is coming), or stops. */
  setBusy(on: boolean) {
    this.busy = on;
    if (on) this.el.setAttribute("data-busy", "");
    else this.el.removeAttribute("data-busy");
  }
  /** Stays on whatever `aim` points at, as the page moves. Null clears. */
  follow(aim: (() => Point | null) | null) {
    this.anchor = aim;
  }
  /** Puts the hand somewhere at once (riding a drag); `held` stops the tremor meanwhile. */
  set(x: number, y: number, held = true) {
    this.held = held;
    this.x = x;
    this.y = y;
    this.write(x, y);
  }
  release() {
    this.held = false;
  }
  /** Travels to the aim as a hand would, and settles there (then stays anchored to it if it is a live aim). */
  moveTo(aim: Aim, pace: HandPace): Promise<void> {
    const first = resolve(aim);
    this.anchor = null;
    if (!first) return Promise.resolve();
    const x0 = this.x;
    const y0 = this.y;
    const dist0 = Math.hypot(first.x - x0, first.y - y0);
    const live = typeof aim === "function" ? aim : null;
    if (dist0 < 1.5) {
      this.anchor = live;
      return Promise.resolve();
    }
    const ms = Math.min(pace.max, pace.min + 55 * Math.log2(dist0 / 16 + 1));
    // The arc: the path bows to one side by a tenth or so of the distance.
    const side = this.noise() < 0.5 ? -1 : 1;
    const bowK = (0.07 + 0.09 * this.noise()) * side;
    this.held = true;
    const t0 = performance.now();
    const from = { x: x0, y: y0 };
    let target = first;
    return new Promise((done) => {
      this.clock.tick((now) => {
        target = resolve(aim) ?? target;
        const p = Math.min(1, (now - t0) / ms);
        if (p >= 1 || this.clock.stopped) {
          this.set(target.x, target.y, false);
          this.anchor = live;
          done();
          return false;
        }
        const at = arcPoint(from, target, p, bowK);
        this.set(at.x, at.y);
        return true;
      });
    });
  }
  /**
   * Scans an object before acting on it: a loop or two around its box (`rx`, `ry` half-axes around `centre`), out from
   * where the hand rests and back onto that point, over `ms`. The direction alternates from one scan to the next.
   */
  orbit(centre: Point, rx: number, ry: number, turns: number, ms: number): Promise<void> {
    const o: Orbit = { rest: { x: this.x, y: this.y }, centre, rx, ry, turns, dir: this.noise() < 0.5 ? 1 : -1 };
    const keep = this.anchor;
    this.anchor = null;
    this.held = true;
    const t0 = performance.now();
    return new Promise((done) => {
      this.clock.tick((now) => {
        const p = Math.min(1, (now - t0) / ms);
        if (p >= 1 || this.clock.stopped) {
          this.set(o.rest.x, o.rest.y, false);
          this.anchor = keep;
          done();
          return false;
        }
        const at = orbitPoint(o, p);
        this.set(at.x, at.y);
        return true;
      });
    });
  }
  /** Drifts slowly to (x, y), as a hand does while its owner reads. */
  drift(x: number, y: number, ms: number): Promise<void> {
    const x0 = this.x;
    const y0 = this.y;
    const t0 = performance.now();
    this.anchor = null;
    return new Promise((resolve) => {
      this.clock.tick((now) => {
        const p = Math.min(1, (now - t0) / ms);
        const u = easeInOut(p);
        this.x = x0 + (x - x0) * u;
        this.y = y0 + (y - y0) * u;
        if (p >= 1 || this.clock.stopped) {
          resolve();
          return false;
        }
        return true;
      });
    });
  }
}
