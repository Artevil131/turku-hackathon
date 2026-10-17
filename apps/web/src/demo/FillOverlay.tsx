import { type Locale, t } from "@aei/i18n";
import { useEffect, useRef, useState } from "react";
import { PAGE_VERSION } from "../components/research/notebook/model.ts";
import { PAGE_EVENT } from "../components/research/notebook/usePage.ts";
import type { FillPlan } from "./openDemo.ts";
import "./fill.css";

// A demo opens empty and fills itself in about twenty seconds: the windows appear one by one, then the notebook's cells.
// Nothing can be clicked meanwhile (this overlay catches every press and key); when it is done the app offers the tour.

const TOTAL_MS = 20_000;
const WINDOW_MS = 900;

export function FillOverlay({ locale, plan, onDone }: { locale: Locale; plan: FillPlan; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)));
    const root = () => document.querySelector<HTMLElement>(".ws");
    const win = (id: string) => document.querySelector<HTMLElement>(`#ws-win-${id}`);
    const run = async () => {
      // The board mounts a moment after the project opens.
      for (let i = 0; i < 40 && !win(plan.windows[0] ?? "") && !cancelled; i++) await wait(150);
      root()?.setAttribute("data-fill", "");
      for (const id of plan.windows) win(id)?.removeAttribute("data-shown");
      const windowsMs = plan.windows.length * WINDOW_MS;
      const cellMs = plan.cells.length ? Math.min(2000, Math.max(700, (TOTAL_MS - windowsMs) / plan.cells.length)) : 0;
      const total = windowsMs + cellMs * plan.cells.length || 1;
      let spent = 0;
      for (const id of plan.windows) {
        if (cancelled) return;
        await wait(WINDOW_MS);
        win(id)?.setAttribute("data-shown", "");
        spent += WINDOW_MS;
        setProgress(Math.min(1, spent / total));
      }
      for (let i = 0; i < plan.cells.length; i++) {
        if (cancelled) return;
        await wait(cellMs);
        dispatchEvent(
          new CustomEvent(PAGE_EVENT, { detail: { slot: plan.slot, page: { v: PAGE_VERSION, cells: plan.cells.slice(0, i + 1) } } }),
        );
        spent += cellMs;
        setProgress(Math.min(1, spent / total));
      }
      await wait(500);
      if (!cancelled) done.current();
    };
    void run().catch(() => done.current());
    // Never leave the screen locked: whatever happens, the lock ends.
    timers.push(setTimeout(() => done.current(), TOTAL_MS + 25_000));
    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
      root()?.removeAttribute("data-fill");
      for (const id of plan.windows) win(id)?.setAttribute("data-shown", "");
    };
  }, [plan]);
  return (
    <div className="fill-lock" role="status" aria-live="polite">
      <div className="fill-pill">
        <span>{t(locale, "demoFilling")}</span>
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}
