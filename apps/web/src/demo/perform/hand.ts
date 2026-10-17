import type { Clock } from "./clock.ts";

// The drawn hand: the cursor element, moved by transform alone on the one clock. It travels like a hand does: a
// Fitts-like time for the distance, a slightly arched path, speed peaking mid-way, a small overshoot that settles,
// a faint tremor while it rests, a slow drift while it reads.

export interface HandPace {
  /** The shortest and longest travel, ms. A move takes `min + 90 · log2(distance / 16 + 1)`, capped at `max`. */
  min: number;
  max: number;
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const easeOut = (p: number) => 1 - (1 - p) ** 3;

export class Hand {
  x: number;
  y: number;
  /** While held (a drag, a travel) the hand does not tremble. */
  private held = false;
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
        const t = now / 1000;
        this.write(
          this.x + Math.sin(t * 2.1) * 0.45 + Math.sin(t * 5.3) * 0.2,
          this.y + Math.cos(t * 1.7) * 0.45 + Math.sin(t * 4.3) * 0.2,
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
  /** Travels to (x, y) as a hand would, and settles there. */
  moveTo(x: number, y: number, pace: HandPace): Promise<void> {
    const x0 = this.x;
    const y0 = this.y;
    const dx = x - x0;
    const dy = y - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) return Promise.resolve();
    const ms = Math.min(pace.max, pace.min + 90 * Math.log2(dist / 16 + 1));
    // The arc: the path bows to one side by a tenth or so of the distance.
    const side = this.noise() < 0.5 ? -1 : 1;
    const bow = dist * (0.07 + 0.09 * this.noise()) * side;
    const cx = x0 + dx * 0.5 - (dy / dist) * bow;
    const cy = y0 + dy * 0.5 + (dx / dist) * bow;
    // The overshoot: a few pixels past the target along the way, then back.
    const over = Math.min(5, 1.5 + dist * 0.008);
    const ox = x + (dx / dist) * over;
    const oy = y + (dy / dist) * over;
    const split = 0.84;
    this.held = true;
    const t0 = performance.now();
    return new Promise((resolve) => {
      this.clock.tick((now) => {
        const p = Math.min(1, (now - t0) / ms);
        let px: number;
        let py: number;
        if (p < split) {
          const u = easeInOut(p / split);
          const v = 1 - u;
          px = v * v * x0 + 2 * v * u * cx + u * u * ox;
          py = v * v * y0 + 2 * v * u * cy + u * u * oy;
        } else {
          const u = easeOut((p - split) / (1 - split));
          px = ox + (x - ox) * u;
          py = oy + (y - oy) * u;
        }
        if (p >= 1 || this.clock.stopped) {
          this.set(x, y, false);
          resolve();
          return false;
        }
        this.set(px, py);
        return true;
      });
    });
  }
  /** Drifts slowly to (x, y), as a hand does while its owner reads. */
  drift(x: number, y: number, ms: number): Promise<void> {
    const x0 = this.x;
    const y0 = this.y;
    const t0 = performance.now();
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
