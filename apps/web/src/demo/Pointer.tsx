import { useEffect, useRef } from "react";
import { Clock } from "./perform/clock.ts";
import { Hand } from "./perform/hand.ts";
import "./perform/perform.css";

// A demo that opens without filling itself in (it has played before, or the setting says so) still shows where
// to look: the performance's drawn hand glides to the first window's title, rests a moment and fades. Nothing is
// locked; the hand takes no clicks. Reduced motion skips it (the caller does not render it).

/** How long the hand rests on the window before it fades, ms. */
const REST_MS = 900;
/** The window the hand points at: the top-most, left-most one on the board. */
function firstWindow(): HTMLElement | null {
  const wins = [...document.querySelectorAll<HTMLElement>("[id^='ws-win-']")];
  if (wins.length === 0) return null;
  return (
    wins
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
      .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)[0]?.el ?? null
  );
}

export function Pointer({ onDone }: { onDone: () => void }) {
  const cursor = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const el = cursor.current;
    if (!el) return;
    const clock = new Clock();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clock.stop();
      done.current();
    };
    (async () => {
      // The windows appear with their own transition; give the board a beat to settle.
      await clock.wait(350);
      const target = firstWindow();
      if (!target || clock.stopped) return finish();
      const box = target.getBoundingClientRect();
      const hand = new Hand(el, clock, innerWidth * 0.6, innerHeight * 0.55);
      hand.show();
      await hand.moveTo(box.left + Math.min(120, box.width * 0.3), box.top + 22, { min: 480, max: 1200 });
      await clock.wait(REST_MS);
      hand.hide();
      await clock.wait(340);
      finish();
    })();
    const safety = setTimeout(finish, 4000);
    // Unmounted early (or re-run in development): stop quietly; `onDone` is for a hand that has pointed.
    return () => {
      clearTimeout(safety);
      finished = true;
      clock.stop();
    };
  }, []);
  return (
    <div ref={cursor} className="pf-cursor" aria-hidden="true">
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
  );
}
