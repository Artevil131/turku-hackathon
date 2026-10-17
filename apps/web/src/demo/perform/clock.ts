// One requestAnimationFrame loop for every wait and every per-frame effect of a demo's fill-in or performance.
// Everything reads the clock rather than counting frames, so a slow frame skips ahead instead of stretching the show.

export class Clock {
  private waits: { at: number; resolve: () => void }[] = [];
  private ticks: ((now: number) => boolean)[] = [];
  private raf = 0;
  private backup = 0;
  stopped = false;
  /** Resolves `ms` from now, on the first frame after. */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.waits.push({ at: performance.now() + ms, resolve });
      this.arm();
    });
  }
  /** Calls `fn` every frame until it returns false. */
  tick(fn: (now: number) => boolean): void {
    this.ticks.push(fn);
    this.arm();
  }
  /** Resolves when `find` returns something, or with null after `maxMs`. */
  waitFor<T>(find: () => T | null | undefined, maxMs: number): Promise<T | null> {
    const found = find();
    if (found) return Promise.resolve(found);
    return new Promise((resolve) => {
      const until = performance.now() + maxMs;
      this.tick((now) => {
        const el = find();
        if (el || now > until || this.stopped) {
          resolve(el ?? null);
          return false;
        }
        return true;
      });
    });
  }
  /** Stops the clock for good: no tick runs again and no wait ever resolves, so nothing scheduled can act after this. */
  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.backup);
    this.raf = 0;
    this.backup = 0;
    this.ticks = [];
    this.waits = [];
  }
  private arm() {
    if (this.raf || this.stopped) return;
    this.raf = requestAnimationFrame(this.frame);
    // A tab in the background gets no frames: the show then goes on at a few steps a second instead of standing still.
    this.backup = window.setTimeout(() => this.frame(performance.now()), 250);
  }
  private frame = (now: number) => {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.backup);
    this.raf = 0;
    this.backup = 0;
    if (this.stopped) return;
    const due = this.waits.filter((w) => w.at <= now).sort((a, b) => a.at - b.at);
    this.waits = this.waits.filter((w) => w.at > now);
    for (const w of due) w.resolve();
    this.ticks = this.ticks.filter((fn) => fn(now));
    if (this.ticks.length || this.waits.length) this.arm();
  };
}
