import { type Locale, t } from "@aei/i18n";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { TourId } from "../demos.ts";
import { type Target, type TourStep, tourFor } from "./steps.ts";
import "./tour.css";

// The guided tour of a demo file: first a small offer, then a drawn cursor that walks the real screen. It points at
// things, clicks real buttons and types into real cells, while a caption card says what is on screen. The page
// itself stays live: a click of your own pauses the tour, and Esc leaves it.

type Phase = "offer" | "play" | "done";
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const resolve = (target: Target | undefined): Element | null =>
  target === undefined ? null : typeof target === "function" ? target() : document.querySelector(target);

/**
 * Where an element shows on screen: its box cut to every scrolling or clipping ancestor (a window, a pane), so a
 * row hidden behind a card or scrolled out of its window gives null instead of a ring floating over something else.
 */
const boxOf = (el: Element | null): Box | null => {
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
};

/** Reading time for a caption: about 3.5 words a second, at least 3.5 s. */
const readMs = (text: string) => Math.max(3500, (text.split(/\s+/).length / 3.5) * 1000 + 700);

/** Types into a React-controlled textarea or input: the native setter, then the input event React listens for. */
function setValue(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

class Stopped extends Error {}

/**
 * The run's clock: waits that hold while paused, end early on Next, and throw when the tour is left. `rush` ends the
 * cursor's approach early when you click the target yourself; `yours` says that click already did the step's action.
 */
function controller() {
  const c = { paused: false, stopped: false, skip: false, rush: false, yours: false };
  const tick = () => new Promise((r) => setTimeout(r, 80));
  const hold = async (ms: number) => {
    let left = ms;
    while (left > 0) {
      if (c.stopped) throw new Stopped();
      if (c.skip || c.rush) return;
      await tick();
      if (!c.paused) left -= 80;
    }
  };
  const until = async (target: Target | undefined, ms: number) => {
    let left = ms;
    while (left > 0) {
      if (c.stopped) throw new Stopped();
      const el = resolve(target);
      if (el && boxOf(el)) return el;
      // There but scrolled out of its pane (a sidebar, a long notebook): bring it into view and look again.
      if (el?.isConnected && !el.closest("[inert], [hidden]")) el.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (c.skip) return null;
      await tick();
      if (!c.paused) left -= 80;
    }
    return null;
  };
  return { c, hold, until };
}

export interface DemoTourProps {
  locale: Locale;
  demo: TourId;
  reducedMotion: boolean;
  onClose: () => void;
}

export function DemoTour({ locale, demo, reducedMotion, onClose }: DemoTourProps) {
  const [phase, setPhase] = useState<Phase>("offer");
  const [steps] = useState<TourStep[]>(() => tourFor(demo, locale));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; ms: number; shown: boolean }>(() => ({
    x: innerWidth / 2,
    y: innerHeight / 2,
    ms: 0,
    shown: false,
  }));
  const [clicks, setClicks] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const ctl = useRef<ReturnType<typeof controller> | null>(null);
  const spotEl = useRef<Element | null>(null);
  /** The current step's target and whether the tour has done its action yet, for clicks of your own. */
  const current = useRef<{ el: Element | null; act: TourStep["act"]; done: boolean }>({ el: null, act: undefined, done: true });
  const card = useRef<HTMLDivElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase === "offer") playButton.current?.focus();
  }, [phase]);

  // The spotlight follows its element while windows move and the page scrolls.
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const follow = () => {
      const b = boxOf(spotEl.current);
      setSpot((s) => (b && s && b.x === s.x && b.y === s.y && b.w === s.w && b.h === s.h ? s : b));
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // The run itself.
  useEffect(() => {
    if (phase !== "play") return;
    const run = controller();
    ctl.current = run;
    const moveTo = async (el: Element) => {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
      await run.hold(reducedMotion ? 50 : 450);
      const b = boxOf(el);
      if (!b) return;
      const x = b.x + Math.min(b.w / 2, 60);
      const y = b.y + Math.min(b.h / 2, 24);
      setCursor((p) => {
        const ms = reducedMotion ? 0 : Math.min(1100, 350 + Math.hypot(x - p.x, y - p.y) * 0.6);
        return { x, y, ms, shown: true };
      });
      await run.hold(reducedMotion ? 50 : 1000);
    };
    (async () => {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i] as TourStep;
        Object.assign(run.c, { skip: false, rush: false, yours: false });
        setIndex(i);
        const el = step.at ? await run.until(step.at, 6000) : null;
        spotEl.current = el;
        current.current = { el, act: step.act, done: false };
        // Nothing to point at: the cursor steps aside rather than resting on whatever it last touched.
        if (el) await moveTo(el);
        else setCursor((p) => ({ ...p, shown: false }));
        run.c.rush = false;
        current.current.done = true;
        if (el && step.act === "click" && run.c.yours) {
          // You clicked it yourself: nothing more to do here.
        } else if (el && step.act === "click") {
          setClicks((n) => n + 1);
          await run.hold(180);
          (el as HTMLElement).click();
        } else if (el && step.act === "type" && step.text && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
          el.focus();
          const text = step.text;
          for (let n = 1; n <= text.length; n += reducedMotion ? text.length : 7) {
            if (run.c.skip) break;
            setValue(el, text.slice(0, n));
            await run.hold(22);
          }
          setValue(el, text);
          el.blur();
        }
        if (el && step.waitFor) await run.until(step.waitFor, step.wait ?? 6000);
        // A click can swap what the target was in (a row becomes a card): keep the ring only while it still shows.
        if (!boxOf(spotEl.current)) spotEl.current = null;
        if (step.show) {
          const shown = resolve(step.show);
          if (shown) {
            spotEl.current = shown;
            shown.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
          }
        }
        run.c.skip = false;
        // A caption that carries on into the next step is read there, so this step only lingers a moment.
        const carriesOn = steps[i + 1]?.say === step.say;
        await run.hold(carriesOn ? 1200 : readMs(t(locale, step.say as "tourClinIntro")));
      }
      spotEl.current = null;
      setPhase("done");
    })().catch((e) => {
      if (!(e instanceof Stopped)) throw e;
    });
    return () => {
      run.c.stopped = true;
    };
  }, [phase, steps, locale, reducedMotion]);

  // Keys while playing. A click of your own on what the cursor points at does the step and moves the tour on;
  // clicks elsewhere are yours to make and leave the tour running.
  useEffect(() => {
    if (phase === "offer") return;
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      if (e.key === "Escape") onClose();
      else if (phase === "play" && !typing && e.key === " ") {
        e.preventDefault();
        togglePause();
      } else if (phase === "play" && !typing && e.key === "ArrowRight") next();
    };
    const click = (e: MouseEvent) => {
      const c = ctl.current?.c;
      const { el, act, done } = current.current;
      if (phase !== "play" || !c || !e.isTrusted || !el || !el.contains(e.target as Node)) return;
      if (!done && act === "click") {
        c.yours = true;
        c.rush = true;
        return;
      }
      // The tour already clicked it: a second click would undo that (close the menu it opened), so it only moves on.
      if (act === "click") {
        e.preventDefault();
        e.stopPropagation();
      }
      next();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("click", click, true);
    };
  });

  const togglePause = () => {
    const c = ctl.current?.c;
    if (!c) return;
    c.paused = !c.paused;
    setPaused(c.paused);
  };
  const next = () => {
    const c = ctl.current?.c;
    if (!c) return;
    c.skip = true;
    c.paused = false;
    setPaused(false);
  };

  if (phase === "offer")
    return (
      <div className="tour-offer" role="dialog" aria-labelledby="tour-offer-title" aria-describedby="tour-offer-body">
        <p className="tour-kicker">{t(locale, "tourLabel")}</p>
        <h2 id="tour-offer-title">{t(locale, demo === "overview" ? "tourOvOfferTitle" : "tourOfferTitle")}</h2>
        <p id="tour-offer-body">{t(locale, demo === "overview" ? "tourOvOfferBody" : "tourOfferBody")}</p>
        <div className="tour-actions">
          <button ref={playButton} type="button" className="btn btn-primary" onClick={() => setPhase("play")}>
            {t(locale, demo === "overview" ? "tourOvOfferPlay" : "tourOfferPlay")}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t(locale, demo === "overview" ? "tourOvOfferSkip" : "tourOfferSkip")}
          </button>
        </div>
      </div>
    );

  const step = steps[Math.min(index, steps.length - 1)] as TourStep;
  const total = steps.length;
  const cardLow = !spot || spot.y + spot.h < innerHeight - 260;
  const spotStyle: CSSProperties | undefined = spot
    ? { transform: `translate(${spot.x - 6}px, ${spot.y - 6}px)`, width: spot.w + 12, height: spot.h + 12 }
    : undefined;
  return (
    <div className="tour" data-paused={paused || undefined} data-reduced={reducedMotion || undefined}>
      {spot && phase === "play" ? <div className="tour-spot" style={spotStyle} aria-hidden="true" /> : null}
      {phase === "play" ? (
        <div
          className="tour-cursor"
          aria-hidden="true"
          data-shown={cursor.shown || undefined}
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transitionDuration: `${cursor.ms}ms, 200ms` }}
        >
          {clicks > 0 ? <span key={clicks} className="tour-ripple" /> : null}
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path
              d="M4 2.5l15 9.2-6.6 1.4 3.9 7.2-2.7 1.4-3.9-7.2-4.7 4.8z"
              fill="#07081c"
              stroke="#fff"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : null}
      <div ref={card} className="tour-card" data-at={cardLow ? "low" : "high"} role="region" aria-label={t(locale, "tourLabel")}>
        <div className="tour-progress" aria-hidden="true">
          <i style={{ width: `${((phase === "done" ? total : index + 1) / total) * 100}%` }} />
        </div>
        <p className="tour-kicker">
          {t(locale, "tourLabel")} · {t(locale, "tourStep", { n: phase === "done" ? total : index + 1, total })}
        </p>
        <p className="tour-say" aria-live="polite">
          {t(locale, step.say as "tourClinIntro")}
        </p>
        <div className="tour-actions">
          {phase === "play" ? (
            <>
              <button type="button" className="btn btn-primary" onClick={togglePause}>
                {t(locale, paused ? "tourResume" : "tourPause")}
              </button>
              <button type="button" className="btn" onClick={next}>
                {t(locale, "tourNext")}
              </button>
              <button type="button" className="btn tour-exit" onClick={onClose}>
                {t(locale, "tourExit")}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t(locale, "tourDone")}
            </button>
          )}
          <span className="tour-keys">{t(locale, "tourKeys")}</span>
        </div>
      </div>
    </div>
  );
}
