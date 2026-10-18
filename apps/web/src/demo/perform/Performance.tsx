import { type Locale, t } from "@aei/i18n";
import { useEffect, useRef } from "react";
import { copy } from "../fillCopy.ts";
import { Clock } from "./clock.ts";
import { type Box, bandFractions, bandWeeks, boxOf, dragBand, fire, resolveTarget, setValue, typeText, until } from "./engine.ts";
import { Hand, type Point } from "./hand.ts";
import { type Beat, mark, type Screenplay, type Target } from "./script.ts";
import "./perform.css";

// A screenplay performs itself: a drawn hand (the guided tour's cursor) operates the real screen the way the
// professional would, while a transparent lock holds every pointer and key. Everything the viewer sees is the app
// reacting to the hand. The lock always lifts, and the caller hears exactly once how: "done" after a full play (or
// the safety timeout), "skipped" when Skip or Escape stopped the clock (a demo then snaps its board to the planned
// end state through `onSkip`). A beat the story cannot do without failing hands over to `onFallback` (the demos'
// plain fill-in), or just ends the show. The same player runs a demo file's fill-in and the two-minute showcase.

/** Beyond the screenplay's own estimate, the lock never holds longer than this. */
const GRACE_MS = 15_000;

/** How long each symbol of a formula takes to appear; the hand reads along at the same speed (perform.css). */
const TOKEN_MS = 45;

export type Outcome = "done" | "skipped";

/** What `aei:perform` carries: the beat about to play and the seconds since the first one; the last event says `done` with the total. */
export interface PerformEvent {
  index: number;
  beat: Beat | null;
  at: number;
  done?: boolean;
}

/** A rough length for a screenplay, to size the safety timeout. */
export function estimateMs(beats: readonly Beat[]): number {
  let ms = 0;
  for (const b of beats) {
    if (b.do === "think") ms += b.ms;
    else if (b.do === "scene") ms += 0;
    else if (b.do === "orbit") ms += (b.ms ?? 2400) + 1200;
    else if (b.do === "look") ms += (b.ms ?? 1000) + 800 + (b.orbit ? 2400 : 0);
    else if (b.do === "type") ms += (b.text.length / (b.cps ?? 36)) * 1000 + 1800;
    else if (b.do === "drag") ms += (b.ms ?? 900) + 2200;
    else if (b.do === "typeset") ms += 3500;
    else if (b.do === "wait") ms += b.timeout ?? 6000;
    else ms += 1400 + ((b as { timeout?: number }).timeout ?? 0) / 2 + ((b as { orbit?: number }).orbit ? 2400 : 0);
  }
  return ms;
}

class Fatal extends Error {}

/** Whether the element is wholly on screen, with nothing clipping it, so no scroll is needed to reach it. */
function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const b = boxOf(el);
  // Clear of the board's floating bars at the bottom and the top edge, not merely inside the window.
  return !!b && r.top >= 70 && r.bottom <= innerHeight - 110 && Math.abs(b.h - r.height) < 1 && Math.abs(b.w - r.width) < 1;
}

/** The hand presses Escape: whatever menu or popover it opened closes, as the app's own handlers see fit. */
function pressEscape(): void {
  const init = { key: "Escape", code: "Escape", bubbles: true, cancelable: true };
  const at = document.activeElement ?? document.body;
  at.dispatchEvent(new KeyboardEvent("keydown", init));
  at.dispatchEvent(new KeyboardEvent("keyup", init));
}

export interface PerformanceProps {
  locale: Locale;
  /** The beats and their pace. Read once, when the player mounts: a new show is a new key. */
  screenplay: Screenplay;
  /** What the show waits for before the first beat: the first window of a demo, the start page of the showcase. */
  stage: Target;
  onDone: (how: Outcome) => void;
  /** A beat the story needs failed: the caller takes over (the demos' plain fill-in). Without it the show just ends. */
  onFallback?: () => void;
  /** Skip or a real Escape, before the lock lifts: a demo snaps its board to the planned end state here. */
  onSkip?: () => void;
  /** Seconds counted down on screen before the first beat, so a screen recording can be started meanwhile. */
  countdown?: number;
  /** The Skip button in the corner; off for a recording. Escape always stops the show. */
  skipButton?: boolean;
}

export function Performance(props: PerformanceProps) {
  const { locale, skipButton: showSkip = true } = props;
  const cursor = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const bracketEl = useRef<HTMLDivElement>(null);
  const countEl = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const latest = useRef(props);
  latest.current = props;
  /** Skip, from the button or a real Escape; set by the run below. */
  const skip = useRef<() => void>(() => {});

  // biome-ignore lint/correctness/useExhaustiveDependencies: one show per mount; the parent keys a new one
  useEffect(() => {
    const clock = new Clock();
    const { pace, beats } = latest.current.screenplay;
    const { stage, countdown = 0 } = latest.current;
    const html = document.documentElement;
    const cursorEl = cursor.current;
    if (!cursorEl) return;
    const before = document.activeElement as HTMLElement | null;
    let ended = false;
    /** The lock lifts exactly once. A skip first lets the caller settle the screen (a demo snaps to its end state). */
    const end = (how: Outcome | "fallback") => {
      if (ended) return;
      ended = true;
      clock.stop();
      cursorEl.removeAttribute("data-shown");
      spot.current?.removeAttribute("data-shown");
      countEl.current?.removeAttribute("data-shown");
      html.removeAttribute("data-perform");
      if (how === "skipped") {
        pressEscape();
        latest.current.onSkip?.();
      }
      (document.activeElement as HTMLElement | null)?.blur?.();
      // Focus goes back where it was, or to the board.
      const back = before?.isConnected ? before : document.querySelector<HTMLElement>(".ws");
      back?.focus?.({ preventScroll: true });
      if (how === "fallback" && latest.current.onFallback) latest.current.onFallback();
      else latest.current.onDone(how === "fallback" ? "done" : how);
    };
    skip.current = () => end("skipped");
    const safety = setTimeout(() => end("done"), estimateMs(beats) + countdown * 1000 + GRACE_MS);
    // Every key and wheel is swallowed while the hand works, except: the hand's own synthetic Escape (it closes what
    // the hand opened), a real Escape (a skip), and Enter or Space on the Skip button itself.
    const swallow = (e: Event) => {
      if (!e.isTrusted) return;
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape" && e.type === "keydown") skip.current();
        else if ((e.key === "Enter" || e.key === " ") && e.target === skipButton.current) return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    for (const type of ["keydown", "keyup", "keypress"]) window.addEventListener(type, swallow, true);
    window.addEventListener("wheel", swallow, { capture: true, passive: false });
    // Keyboard users are not stuck: Skip holds the focus while the hand works.
    skipButton.current?.focus({ preventScroll: true });
    // Results, formulas and charts fade in while the hand works (perform.css).
    html.setAttribute("data-perform", "");

    // Math that arrives while the hand works writes itself: each symbol fades in on its own beat, then the letters'
    // values follow (perform.css). Marked in the same microtask the node is added, before the first paint.
    const typeset = (root: Element) => {
      const maths = root.matches("math") ? [root] : [...root.querySelectorAll("math")];
      for (const m of maths) {
        if (m.hasAttribute("data-typeset")) continue;
        const tokens = m.querySelectorAll<HTMLElement>("mi,mn,mo,mtext");
        const step = Math.min(TOKEN_MS, 1100 / Math.max(1, tokens.length));
        m.setAttribute("data-step", String(step));
        tokens.forEach((tk, i) => {
          tk.style.setProperty("--d", `${Math.round(i * step)}ms`);
        });
        m.setAttribute("data-typeset", "");
        const method = m.closest(".nb-method");
        method?.querySelectorAll<HTMLElement>(".nb-letters > div").forEach((d, i) => {
          d.style.animationDelay = `${Math.round(tokens.length * step) + 150 + i * 150}ms`;
        });
      }
    };
    const typesetter = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n instanceof Element) typeset(n);
    });
    typesetter.observe(document.body, { childList: true, subtree: true });
    typeset(document.body);

    // ----- the hand and the ring: written straight to the DOM, never through React state -----
    const hand = new Hand(cursorEl, clock, innerWidth * 0.55, innerHeight * 0.4);
    let ringed: Element | null = null;
    let lastBox: Box | null = null;
    const ring = (el: Element | null) => {
      ringed = el;
      if (!el) {
        spot.current?.removeAttribute("data-shown");
        lastBox = null;
      }
    };
    clock.tick(() => {
      const s = spot.current;
      if (!s) return !clock.stopped;
      // Every frame: a ring that lags a scrolling page by even 70 ms reads as the cursor and the page disagreeing.
      const b = boxOf(ringed);
      if (!b) {
        if (lastBox) {
          s.removeAttribute("data-shown");
          lastBox = null;
        }
        return !clock.stopped;
      }
      if (!lastBox || b.x !== lastBox.x || b.y !== lastBox.y || b.w !== lastBox.w || b.h !== lastBox.h) {
        // A ring that was not showing appears on its target; it glides only from one target to the next.
        const fresh = !lastBox;
        if (fresh) s.style.transition = "none";
        s.style.transform = `translate(${b.x - 5}px, ${b.y - 5}px)`;
        s.style.width = `${b.w + 10}px`;
        s.style.height = `${b.h + 10}px`;
        if (fresh) {
          void s.offsetWidth;
          s.style.transition = "";
        }
        s.setAttribute("data-shown", "");
        lastBox = b;
      }
      return !clock.stopped;
    });
    /** The press: a short dwell, the hand dips for the press time, a soft ring spreads from it. */
    const press = async () => {
      await clock.wait(pace.dwell);
      const r = document.createElement("span");
      r.className = "pf-ripple";
      cursorEl.appendChild(r);
      cursorEl.setAttribute("data-pressed", "");
      await clock.wait(pace.press);
      cursorEl.removeAttribute("data-pressed");
      void clock.wait(300).then(() => r.remove());
    };
    /** A bracket over the chosen weeks of a band, with their dates above it; follows the shade while it grows. */
    const bracketAround = (range: Element | null, text: string) => {
      const br = bracketEl.current;
      if (!br || !range) return;
      const r = range.getBoundingClientRect();
      br.style.transform = `translate(${r.left}px, ${r.bottom - 2}px)`;
      br.style.width = `${Math.max(3, r.width)}px`;
      const label = br.firstElementChild;
      if (label && text) label.textContent = text;
      br.setAttribute("data-shown", "");
    };
    /** Resolves once the element has stopped moving on screen (a scroll ended, a result finished pushing it down). */
    const settled = (el: Element) => {
      let last = Number.NaN;
      let since = performance.now();
      return clock.waitFor(() => {
        const top = el.getBoundingClientRect().top;
        const now = performance.now();
        if (top !== last) {
          last = top;
          since = now;
          return null;
        }
        return now - since > 90 ? true : null;
      }, 1000);
    };
    /**
     * Scans an element the way eyes do before a hand acts: `turns` loops around its box, sized to it (a button gets a
     * tight quick loop, a window a wide slow one), the ring on it the whole time.
     */
    const orbit = async (el: Element, turns: number, msWanted?: number) => {
      const b = boxOf(el);
      if (!b || turns <= 0) return;
      const rx = Math.min(b.w / 2 + 18, 190);
      const ry = Math.min(b.h / 2 + 14, 130);
      // About 1.3 ms per pixel of path, never a blink and never a wait.
      const path = turns * 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
      const ms = msWanted ?? Math.min(2400, Math.max(700, path * 1.3));
      await hand.orbit({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, rx, ry, turns, ms);
    };
    /**
     * Walks the hand to an element, scrolling it into view at the same time. The hand's goal is live (asked every
     * frame), so it lands on the element wherever the scroll and the layout put it, and it stays on it afterwards.
     * The ring appears as the hand arrives; with `turns`, the hand scans the element before it rests.
     */
    const moveTo = async (el: Element, aim: "centre" | "start" = "centre", turns = 0) => {
      hand.show();
      if (!inView(el)) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      const goal = (): Point | null => {
        const b = boxOf(el);
        if (b) {
          return aim === "start"
            ? { x: b.x + Math.min(b.w / 2, 26), y: b.y + Math.min(b.h / 2, 18) }
            : { x: b.x + Math.min(b.w / 2, 56), y: b.y + Math.min(b.h / 2, 22) };
        }
        // Still out of view (mid-scroll): head the way it lies.
        const r = el.getBoundingClientRect();
        if (!el.isConnected || (r.width === 0 && r.height === 0)) return null;
        return {
          x: Math.min(innerWidth - 24, Math.max(24, r.left + Math.min(r.width / 2, 56))),
          y: Math.min(innerHeight - 120, Math.max(80, r.top + 12)),
        };
      };
      await hand.moveTo(goal, pace);
      ring(el);
      await settled(el);
      if (turns > 0) await orbit(el, turns);
      return boxOf(el);
    };
    const find = async (target: Target, timeout: number, must: boolean | undefined, visible = true) => {
      // Not there yet after a moment (a tool computing, a cell mounting): the hand circles and the ring breathes
      // instead of standing still.
      let over = false;
      void clock.wait(400).then(() => {
        if (over) return;
        hand.setBusy(true);
        spot.current?.setAttribute("data-busy", "");
      });
      try {
        const el = await until(target, timeout, clock, visible);
        if (!el && must) throw new Fatal();
        return el;
      } finally {
        over = true;
        hand.setBusy(false);
        spot.current?.removeAttribute("data-busy");
      }
    };
    /** Waits for what a click or a tool causes (it need only exist). */
    const waiting = (target: Target, timeout: number, must: boolean | undefined) => find(target, timeout, must, false);
    /** A timing mark for whoever tunes the show (performance.getEntriesByType("mark") in the console); free otherwise. */
    const stamp = (what: string) => performance.mark(`perform:${what}`);

    const perform = async (beat: Beat): Promise<void> => {
      switch (beat.do) {
        case "think":
          return clock.wait(beat.ms);
        case "look": {
          const el = await find(beat.at, beat.timeout ?? pace.timeout, false);
          if (!el) return;
          const b = await moveTo(el, "start", beat.orbit ?? 0);
          if (!b) return;
          // Reading: the hand drifts along the line, then rests.
          const ms = beat.ms ?? 1000;
          await hand.drift(hand.x + Math.min(b.w - 40, 120), hand.y + 3, ms * 0.7);
          await clock.wait(ms * 0.3);
          ring(null);
          return;
        }
        case "orbit": {
          const el = await find(beat.at, beat.timeout ?? pace.timeout, false);
          if (!el) return;
          if (!(await moveTo(el, "centre"))) return;
          await orbit(el, beat.turns ?? 1.5, beat.ms);
          await clock.wait(200);
          ring(null);
          return;
        }
        case "click": {
          const el = await find(beat.at, beat.timeout ?? pace.timeout, beat.must);
          if (!el) return;
          stamp("found");
          if (!(await moveTo(el, "centre", beat.orbit ?? 0))) return;
          stamp("arrived");
          if (beat.mark) mark();
          await press();
          fire(el);
          stamp("clicked");
          if (beat.wait) await waiting(beat.wait, beat.timeout ?? pace.timeout, beat.must);
          stamp("answered");
          // What the click caused gets two frames to paint before the hand moves on.
          await clock.wait(32);
          ring(null);
          return;
        }
        case "type": {
          const el = await find(beat.at, pace.timeout, beat.must);
          if (!el) return;
          if (!(await moveTo(el, "start", beat.orbit ?? 0))) return;
          await clock.wait(pace.dwell);
          await typeText(el, beat.text, beat.cps ?? pace.cps, clock, beat.stay);
          await clock.wait(100);
          ring(null);
          return;
        }
        case "pick": {
          const el = await find(beat.at, pace.timeout, beat.must);
          if (!el) return;
          if (!(await moveTo(el, "centre", beat.orbit ?? 0))) return;
          await press();
          if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
            el.focus();
            setValue(el, beat.value);
            await clock.wait(140);
            el.blur();
          }
          ring(null);
          return;
        }
        case "drag": {
          const el = await find(beat.at, pace.timeout, false);
          if (!el) return;
          if (!(await moveTo(el))) return;
          ring(null);
          const ms = beat.ms ?? 900;
          // The frame the analysis is about, on the band's own axis; the last `weeks` up to the clock when the band no longer shows it.
          const dated = beat.dates ? bandFractions(el, beat.dates[0], beat.dates[1]) : null;
          const span = beat.weeks ? bandWeeks(el) : null;
          const from = dated ? dated[0] : span && beat.weeks ? Math.max(0, 1 - beat.weeks / span) : (beat.from ?? 0.7);
          const to = dated ? dated[1] : span ? 1 : (beat.to ?? 1);
          hand.follow(null);
          await dragBand(
            el,
            from,
            to,
            ms,
            clock,
            (x, y) => hand.moveTo({ x, y }, pace),
            (x, y) => {
              hand.set(x, y);
              // The chosen weeks, read off the band's own label, are bracketed and named as they grow.
              const said = el.querySelector(".hs-range-label-text")?.textContent;
              bracketAround(el.querySelector(".hs-range"), said ?? "");
            },
          );
          hand.release();
          const range = el.querySelector(".hs-range");
          range?.classList.add("pf-flash");
          // The frame stays marked a moment, large, so it can be read: a bracket over the chosen weeks with their dates.
          await clock.wait(1300);
          range?.classList.remove("pf-flash");
          bracketEl.current?.removeAttribute("data-shown");
          return;
        }
        case "typeset": {
          // The formula writes itself symbol by symbol (typeset below); the hand reads along, then visits each letter's value.
          const el = await find(beat.at, beat.timeout ?? pace.timeout, false);
          if (!el) return;
          const b = await moveTo(el, "start");
          if (!b) return;
          const math = el.matches("math") ? el : el.querySelector("math");
          const n = math?.querySelectorAll("mi,mn,mo,mtext").length ?? 0;
          const step = Number(math?.getAttribute("data-step") ?? TOKEN_MS);
          await hand.drift(b.x + Math.min(b.w - 30, b.w * 0.8), hand.y + 2, n * step + 150);
          const values = [...(el.closest(".nb-method")?.querySelectorAll(".nb-letters dd") ?? [])].slice(0, 3);
          for (const dd of values) {
            if (!(await moveTo(dd, "start"))) break;
            await clock.wait(120);
          }
          ring(null);
          return;
        }
        case "wait":
          await waiting(beat.for, beat.timeout ?? pace.timeout, beat.must);
          await clock.wait(32);
          return;
        case "escape":
          pressEscape();
          return clock.wait(100);
        case "scene":
          return;
      }
    };

    /** The show's clock for whoever writes a narration against it: seconds since the first beat, one decimal. */
    let t0 = 0;
    const since = () => Math.round((performance.now() - t0) / 100) / 10;
    const announce = (detail: PerformEvent) => dispatchEvent(new CustomEvent<PerformEvent>("aei:perform", { detail }));

    (async () => {
      // The stage mounts a moment after the page opens: the first frame it is there, the performance begins.
      const stageEl = await clock.waitFor(() => resolveTarget(stage), 8000);
      if (clock.stopped) return;
      if (!stageEl) throw new Fatal();
      stamp("stage");
      const b = boxOf(stageEl);
      if (b) hand.set(b.x + b.w * 0.6, b.y + Math.min(b.h, 160), false);
      // A countdown before the hand shows: time to press record.
      const count = countEl.current;
      if (countdown > 0 && count) {
        count.setAttribute("data-shown", "");
        for (let n = countdown; n > 0; n--) {
          count.textContent = t(locale, "demoShowcaseCountdown", { n: String(n) });
          await clock.wait(1000);
          if (clock.stopped) return;
        }
        count.removeAttribute("data-shown");
      }
      hand.show();
      await clock.wait(120);
      t0 = performance.now();
      for (const [index, beat] of beats.entries()) {
        if (clock.stopped) return;
        // A beat's start is announced with its time (for anyone timing the show); nothing listens by default.
        const at = since();
        announce({ index, beat, at });
        stamp(`beat ${index} ${beat.do}`);
        if (beat.do === "scene" && import.meta.env.DEV) console.info(`perform · ${at.toFixed(1)} s · ${beat.name}`);
        await perform(beat);
      }
      // The hand leaves a clean screen: nothing ringed, nothing open, nothing focused.
      ring(null);
      pressEscape();
      hand.hide();
      await clock.wait(200);
      const total = since();
      announce({ index: beats.length, beat: null, at: total, done: true });
      if (import.meta.env.DEV) console.info(`perform · total ${total.toFixed(1)} s`);
      end("done");
    })().catch((e: unknown) => {
      // The caller takes over (the demos' plain fill-in); the reason stays in the console for whoever tunes the screenplay.
      console.warn("performance: a beat the story needs failed", e);
      end("fallback");
    });

    return () => {
      typesetter.disconnect();
      clearTimeout(safety);
      for (const type of ["keydown", "keyup", "keypress"]) window.removeEventListener(type, swallow, true);
      window.removeEventListener("wheel", swallow, true);
      html.removeAttribute("data-perform");
      if (!ended) {
        ended = true;
        clock.stop();
      }
    };
  }, []);

  return (
    <div className="pf-lock" role="status" aria-live="polite" onContextMenu={(e) => e.preventDefault()}>
      <div ref={spot} className="pf-spot" aria-hidden="true" />
      <div ref={bracketEl} className="pf-bracket" aria-hidden="true">
        <span />
      </div>
      <div ref={countEl} className="pf-count" />
      <div ref={cursor} className="pf-cursor" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path
            d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.7 1.4-3.9-7.2-4.7 4.8z"
            fill="#07081c"
            paintOrder="stroke"
            stroke="#fff"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="visually-hidden">{t(locale, "demoFilling")}</p>
      {showSkip ? (
        <button ref={skipButton} type="button" className="pf-skip" onClick={() => skip.current()}>
          {copy(locale, "skip")}
        </button>
      ) : null}
    </div>
  );
}
