import { type Locale, t } from "@aei/i18n";
import { useEffect, useRef } from "react";
import { applyPlan } from "../applyPlan.ts";
import type { DemoId } from "../demos.ts";
import { copy } from "../fillCopy.ts";
import type { FillPlan } from "../openDemo.ts";
import { Clock } from "./clock.ts";
import { type Box, bandWeeks, boxOf, dragBand, fire, resolveTarget, setValue, typeText, until } from "./engine.ts";
import { Hand } from "./hand.ts";
import { type Beat, mark, type Target } from "./script.ts";
import { screenplayFor } from "./scripts.ts";
import "./perform.css";

// A demo performs itself: a drawn hand (the guided tour's cursor) operates the real screen the way the professional
// would, while a transparent lock holds every pointer and key. Everything the viewer sees is the app reacting to
// the hand. The lock always lifts, and the caller hears exactly once how: "done" after a full play (or the safety
// timeout), "skipped" when Skip or Escape stopped the clock and the board snapped to the planned end state. A beat
// the story cannot do without failing hands over to the plain fill-in instead.

/** Beyond the screenplay's own estimate, the lock never holds longer than this. */
const GRACE_MS = 15_000;

export type Outcome = "done" | "skipped";

/** A rough length for a screenplay, to size the safety timeout. */
function estimateMs(beats: readonly Beat[]): number {
  let ms = 0;
  for (const b of beats) {
    if (b.do === "think") ms += b.ms;
    else if (b.do === "look") ms += (b.ms ?? 1000) + 800;
    else if (b.do === "type") ms += (b.text.length / (b.cps ?? 36)) * 1000 + 1800;
    else if (b.do === "drag") ms += (b.ms ?? 900) + 800;
    else if (b.do === "wait") ms += b.timeout ?? 6000;
    else ms += 1400 + ((b as { timeout?: number }).timeout ?? 0) / 2;
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

export function Performance({
  locale,
  demo,
  plan,
  onDone,
  onFallback,
}: {
  locale: Locale;
  demo: DemoId;
  plan: FillPlan;
  onDone: (how: Outcome) => void;
  /** A beat the story needs failed: the caller takes over with the plain fill-in. */
  onFallback: () => void;
}) {
  const cursor = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onDone, onFallback });
  callbacks.current = { onDone, onFallback };
  /** Skip, from the button or a real Escape; set by the run below. */
  const skip = useRef<() => void>(() => {});

  useEffect(() => {
    const clock = new Clock();
    const { pace, beats } = screenplayFor(demo, locale);
    const html = document.documentElement;
    const cursorEl = cursor.current;
    if (!cursorEl) return;
    const before = document.activeElement as HTMLElement | null;
    let ended = false;
    /** The lock lifts exactly once. A skip first snaps the board to the planned end state. */
    const end = (how: Outcome | "fallback") => {
      if (ended) return;
      ended = true;
      clock.stop();
      cursorEl.removeAttribute("data-shown");
      spot.current?.removeAttribute("data-shown");
      html.removeAttribute("data-perform");
      if (how === "skipped") {
        pressEscape();
        applyPlan(plan);
      }
      (document.activeElement as HTMLElement | null)?.blur?.();
      // Focus goes back where it was, or to the board.
      const back = before?.isConnected ? before : document.querySelector<HTMLElement>(".ws");
      back?.focus?.({ preventScroll: true });
      if (how === "fallback") callbacks.current.onFallback();
      else callbacks.current.onDone(how);
    };
    skip.current = () => end("skipped");
    const safety = setTimeout(() => end("done"), estimateMs(beats) + GRACE_MS);
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
    let measured = 0;
    clock.tick((now) => {
      const s = spot.current;
      if (!s) return !clock.stopped;
      // boxOf reads layout (every scrolling ancestor): a few times a second is plenty for a ring that glides anyway.
      if (now - measured < 70) return !clock.stopped;
      measured = now;
      const b = boxOf(ringed);
      if (!b) {
        if (lastBox) {
          s.removeAttribute("data-shown");
          lastBox = null;
        }
        return !clock.stopped;
      }
      if (!lastBox || b.x !== lastBox.x || b.y !== lastBox.y || b.w !== lastBox.w || b.h !== lastBox.h) {
        s.style.transform = `translate(${b.x - 5}px, ${b.y - 5}px)`;
        s.style.width = `${b.w + 10}px`;
        s.style.height = `${b.h + 10}px`;
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
    /** Brings the element into view and walks the hand to it; resolves with where it is, or null if it has gone. */
    const moveTo = async (el: Element, aim: "centre" | "start" = "centre") => {
      if (!inView(el)) {
        // At once and to the middle: a smooth scroll still running would leave the hand where the target was.
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        await clock.wait(34);
      }
      const b = boxOf(el);
      if (!b) return null;
      const x = aim === "start" ? b.x + Math.min(b.w / 2, 26) : b.x + Math.min(b.w / 2, 56);
      const y = aim === "start" ? b.y + Math.min(b.h / 2, 18) : b.y + Math.min(b.h / 2, 22);
      hand.show();
      ring(el);
      await hand.moveTo(x, y, pace);
      return boxOf(el);
    };
    const find = async (target: Target, timeout: number, must: boolean | undefined, visible = true) => {
      const el = await until(target, timeout, clock, visible);
      if (!el && must) throw new Fatal();
      return el;
    };
    /** A timing mark for whoever tunes the show (performance.getEntriesByType("mark") in the console); free otherwise. */
    const stamp = (what: string) => performance.mark(`perform:${what}`);

    const perform = async (beat: Beat): Promise<void> => {
      switch (beat.do) {
        case "think":
          return clock.wait(beat.ms);
        case "look": {
          const el = await find(beat.at, pace.timeout, false);
          if (!el) return;
          const b = await moveTo(el, "start");
          if (!b) return;
          // Reading: the hand drifts along the line, then rests.
          const ms = beat.ms ?? 1000;
          await hand.drift(hand.x + Math.min(b.w - 40, 120), hand.y + 3, ms * 0.7);
          await clock.wait(ms * 0.3);
          ring(null);
          return;
        }
        case "click": {
          const el = await find(beat.at, beat.timeout ?? pace.timeout, beat.must);
          if (!el) return;
          stamp("found");
          if (!(await moveTo(el))) return;
          stamp("arrived");
          if (beat.mark) mark();
          await press();
          fire(el);
          stamp("clicked");
          if (beat.wait) await find(beat.wait, beat.timeout ?? pace.timeout, beat.must, false);
          stamp("answered");
          // What the click caused gets two frames to paint before the hand moves on.
          await clock.wait(32);
          ring(null);
          return;
        }
        case "type": {
          const el = await find(beat.at, pace.timeout, beat.must);
          if (!el) return;
          if (!(await moveTo(el, "start"))) return;
          await clock.wait(pace.dwell);
          await typeText(el, beat.text, beat.cps ?? pace.cps, clock);
          await clock.wait(100);
          ring(null);
          return;
        }
        case "pick": {
          const el = await find(beat.at, pace.timeout, beat.must);
          if (!el) return;
          if (!(await moveTo(el))) return;
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
          const span = beat.weeks ? bandWeeks(el) : null;
          const from = span && beat.weeks ? Math.max(0, 1 - beat.weeks / span) : (beat.from ?? 0.7);
          const to = span ? 1 : (beat.to ?? 1);
          let first = true;
          await dragBand(el, from, to, ms, clock, (x, y) => {
            if (first) {
              first = false;
              void hand.moveTo(x, y, pace);
            } else hand.set(x, y);
          });
          hand.release();
          return;
        }
        case "wait":
          await find(beat.for, beat.timeout ?? pace.timeout, beat.must, false);
          await clock.wait(32);
          return;
        case "escape":
          pressEscape();
          return clock.wait(100);
      }
    };

    (async () => {
      // The board mounts a moment after the project opens: the first frame it is there, the performance begins.
      const stage = await clock.waitFor(() => resolveTarget(`.ws-win[data-win="${plan.windows[0] ?? ""}"]`), 8000);
      if (clock.stopped) return;
      if (!stage) throw new Fatal();
      stamp("stage");
      const b = boxOf(stage);
      if (b) hand.set(b.x + b.w * 0.6, b.y + Math.min(b.h, 160), false);
      hand.show();
      await clock.wait(120);
      for (const [index, beat] of beats.entries()) {
        if (clock.stopped) return;
        // A beat's start is announced (for anyone timing the show from the console); nothing listens by default.
        dispatchEvent(new CustomEvent("aei:perform", { detail: { index, beat } }));
        stamp(`beat ${index} ${beat.do}`);
        await perform(beat);
      }
      // The hand leaves a clean screen: nothing ringed, nothing open, nothing focused.
      ring(null);
      pressEscape();
      hand.hide();
      await clock.wait(200);
      end("done");
    })().catch((e: unknown) => {
      // The plain fill-in takes over; the reason stays in the console for whoever tunes the screenplay.
      console.warn("demo performance: falling back to the plain fill", e);
      end("fallback");
    });

    return () => {
      clearTimeout(safety);
      for (const type of ["keydown", "keyup", "keypress"]) window.removeEventListener(type, swallow, true);
      window.removeEventListener("wheel", swallow, true);
      html.removeAttribute("data-perform");
      if (!ended) {
        ended = true;
        clock.stop();
      }
    };
  }, [demo, locale, plan]);

  return (
    <div className="pf-lock" role="status" aria-live="polite" onContextMenu={(e) => e.preventDefault()}>
      <div ref={spot} className="pf-spot" aria-hidden="true" />
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
      <button ref={skipButton} type="button" className="pf-skip" onClick={() => skip.current()}>
        {copy(locale, "skip")}
      </button>
    </div>
  );
}
