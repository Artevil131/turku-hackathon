import { type Locale, t } from "@aei/i18n";
import { useEffect, useRef, useState } from "react";
import { type NbCell, PAGE_VERSION } from "../components/research/notebook/model.ts";
import { PAGE_EVENT } from "../components/research/notebook/usePage.ts";
import { applyPlan } from "./applyPlan.ts";
import { copy } from "./fillCopy.ts";
import { countUp, drawLines, placeInto, press, sweep, typeInto } from "./fillEffects.ts";
import { demoOf, PACE, resolve, type Step } from "./fillScript.ts";
import { scriptFor } from "./fillScripts.ts";
import type { FillPlan } from "./openDemo.ts";
import { Clock } from "./perform/clock.ts";
import { type Outcome, Performance } from "./perform/Performance.tsx";
import { win as winTarget } from "./perform/script.ts";
import { screenplayFor } from "./perform/scripts.ts";
import "./fill.css";

// A demo opens empty and fills itself in while the screen is locked. First choice: a performance (perform/), in
// which a drawn cursor operates the real screen the way the professional would. If the demo has no screenplay, or
// a beat the story cannot do without fails, the plain fill-in below takes over: the planned notebook is handed to
// the page beat by beat (fillScripts.ts). Either way the lock always lifts and `onDone` hears exactly once how:
// "done" after a full play, "skipped" after Skip or Escape (the board then snaps to the planned end state).

export function FillOverlay(props: { locale: Locale; plan: FillPlan; onDone: (how: Outcome) => void }) {
  const [mode, setMode] = useState<"perform" | "plain">(() => (demoOf(props.plan) ? "perform" : "plain"));
  const demo = demoOf(props.plan);
  if (mode === "perform" && demo)
    return (
      <Performance
        locale={props.locale}
        screenplay={screenplayFor(demo, props.locale)}
        // The board mounts a moment after the project opens: its first window is the stage.
        stage={winTarget(props.plan.windows[0] ?? "")}
        onDone={props.onDone}
        onSkip={() => applyPlan(props.plan)}
        onFallback={() => setMode("plain")}
      />
    );
  return <PlainFill {...props} />;
}

/** The plain fill-in never holds the screen longer than its script plus this. */
const GRACE_MS = 8_000;
const EASE = "var(--mo-ease)";

/** The notebook as the viewer sees it mid-fill: the plan's cells, so many of them shown, some not yet run or still folded. */
class Stage {
  cells: NbCell[];
  shown = 0;
  private plan: FillPlan;
  constructor(plan: FillPlan) {
    this.plan = plan;
    this.cells = [...plan.cells];
  }
  show(i: number) {
    if (i + 1 > this.shown) this.shown = i + 1;
    this.dispatch();
  }
  set(i: number, patch: Partial<NbCell>) {
    const cell = this.cells[i];
    if (cell) this.cells[i] = { ...cell, ...patch } as NbCell;
    this.show(i);
  }
  dispatch(cells = this.cells.slice(0, this.shown)) {
    dispatchEvent(new CustomEvent(PAGE_EVENT, { detail: { slot: this.plan.slot, page: { v: PAGE_VERSION, cells } } }));
  }
}

const root = () => document.querySelector<HTMLElement>(".ws");
const win = (id: string) => document.getElementById(`ws-win-${id}`);
const cellOf = (c: NbCell | undefined) => (c ? document.querySelector<HTMLElement>(`.nb-cell[data-cell="${c.id}"]`) : null);

function PlainFill({ locale, plan, onDone }: { locale: Locale; plan: FillPlan; onDone: (how: Outcome) => void }) {
  const bar = useRef<HTMLElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const skip = useRef<() => void>(() => {});
  useEffect(() => {
    const clock = new Clock();
    const stage = new Stage(plan);
    const { steps, total } = resolve(scriptFor(plan), plan);
    let finished = false;
    /** Whatever the beats got to: every mark gone, every window shown, the page as planned (and saved as such). */
    const settle = () => {
      finished = true;
      clock.stop();
      const ws = root();
      if (ws) {
        ws.removeAttribute("data-fill");
        sweep(ws);
      }
      applyPlan(plan);
    };
    const finish = (how: Outcome = "done") => {
      if (finished) return;
      settle();
      done.current(how);
    };
    skip.current = () => finish("skipped");
    const safety = setTimeout(() => finish("done"), total * 1000 + GRACE_MS);
    // Every key is swallowed while the colleague works (a real Escape skips); the overlay itself takes the pointer.
    const swallow = (e: Event) => {
      if (!e.isTrusted) return;
      if (e instanceof KeyboardEvent && e.key === "Escape" && e.type === "keydown") skip.current();
      e.preventDefault();
      e.stopPropagation();
    };
    for (const type of ["keydown", "keyup", "keypress"]) window.addEventListener(type, swallow, true);
    (document.activeElement as HTMLElement | null)?.blur?.();

    /** The element of a cell once the notebook has rendered it, scrolled into view and marked as being worked on. */
    const cellEl = async (i: number) => {
      const el = await clock.waitFor(() => cellOf(stage.cells[i]), 3000);
      if (el) {
        el.setAttribute("data-fill-active", "");
        el.scrollIntoView({ block: "nearest" });
      }
      return el;
    };
    const perform = async (step: Step): Promise<void> => {
      const ease = step.ease ?? EASE;
      switch (step.do) {
        case "reveal": {
          // Windows are in place from the start; a reveal only counts its figures up, if it has any.
          const el = win(step.window);
          if (!el) return;
          const ms = (step.for ?? (step.how === "wipe" ? PACE.wipe : PACE.rise)) * 1000;
          countUp(el, Math.max(400, ms), clock);
          return clock.wait(ms);
        }
        case "write": {
          stage.show(step.cell);
          const el = await cellEl(step.cell);
          const note = el?.querySelector<HTMLElement>(".nb-note");
          if (el && note) await typeInto(note, step.cps ?? PACE.cps, clock);
          el?.setAttribute("data-fill-done", "");
          return;
        }
        case "place": {
          stage.show(step.cell);
          const el = await cellEl(step.cell);
          const sentence = el?.querySelector<HTMLElement>(".nb-sentence");
          if (el && sentence) {
            el.setAttribute("data-fill-placing", "");
            await placeInto(sentence, (step.each ?? PACE.field) * 1000, clock);
            el.removeAttribute("data-fill-placing");
          }
          el?.setAttribute("data-fill-done", "");
          return;
        }
        case "show": {
          stage.show(step.cell);
          const el = await cellEl(step.cell);
          el?.setAttribute("data-fill-done", "");
          return;
        }
        case "run": {
          const planned = plan.cells[step.cell];
          if (planned?.kind !== "analysis") return;
          stage.set(step.cell, { result: null });
          const el = await cellEl(step.cell);
          if (!el) return;
          await clock.wait(PACE.press * 1000);
          const button = el.querySelector<HTMLElement>(".nb-run");
          button?.setAttribute("data-fill-pressed", "");
          await clock.wait((step.think ?? PACE.think) * 1000);
          if (clock.stopped) return;
          stage.set(step.cell, { result: planned.result });
          const ms = (step.for ?? PACE.numbers) * 1000;
          el.style.setProperty("--fill-for", `${ms}ms`);
          el.style.setProperty("--fill-ease", ease);
          const result = await clock.waitFor(() => el.querySelector(".tl-cell"), 2000);
          el.setAttribute("data-fill-result", "");
          if (result) countUp(result, ms, clock);
          await clock.wait(ms);
          button?.removeAttribute("data-fill-pressed");
          el.setAttribute("data-fill-done", "");
          return;
        }
        case "draw": {
          stage.set(step.cell, { collapsed: false });
          const el = await cellEl(step.cell);
          if (!el) return;
          const ms = (step.for ?? PACE.draw) * 1000;
          const line = await clock.waitFor(() => el.querySelector(".ch-line"), 3000);
          el.setAttribute("data-fill-done", "");
          if (!line || clock.stopped) return;
          const undo = drawLines(el, ms, ease);
          await clock.wait(ms + 400);
          undo();
          return;
        }
        case "pick": {
          const el = win(step.window)?.querySelector<HTMLElement>(step.target);
          if (el) await press(el, step.value, clock);
          return;
        }
        case "veil": {
          const el = win(step.window);
          if (step.on) el?.setAttribute("data-fill-veil", step.target);
          else el?.removeAttribute("data-fill-veil");
          return;
        }
        case "done":
          return;
      }
    };

    const run = async () => {
      // The board mounts a moment after the project opens: the first frame it is there, the fill begins.
      const first = await clock.waitFor(() => win(plan.windows[0] ?? ""), 6000);
      if (clock.stopped) return;
      if (first) root()?.setAttribute("data-fill", "");
      if (bar.current) {
        bar.current.style.transition = `transform ${total}s linear`;
        bar.current.style.transform = "scaleX(1)";
      }
      const t0 = performance.now();
      const running = steps.map((s) =>
        clock.wait(t0 + s.start * 1000 - performance.now()).then(() => (clock.stopped ? undefined : perform(s.step))),
      );
      await Promise.allSettled(running);
      if (clock.stopped) return;
      await clock.wait(350);
      finish("done");
    };
    void run().catch(() => finish("done"));

    return () => {
      clearTimeout(safety);
      for (const type of ["keydown", "keyup", "keypress"]) window.removeEventListener(type, swallow, true);
      if (!finished) settle();
    };
  }, [plan]);
  return (
    <div className="fill-lock" role="status" aria-live="polite" onContextMenu={(e) => e.preventDefault()}>
      <div className="fill-pill">
        <span>{t(locale, "demoFilling")}</span>
        <i ref={bar} aria-hidden="true" />
      </div>
      <button type="button" className="pf-skip" onClick={() => skip.current()}>
        {copy(locale, "skip")}
      </button>
    </div>
  );
}
