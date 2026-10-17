import type { AeiClient, WeeklyResponse } from "@aei/contract";
import { useEffect, useRef, useState } from "react";
import { backoffDelay } from "../../backoff.ts";
import { dayNumber } from "./geometry.ts";

/** Monday of the week holding the day. */
const mondayOf = (iso: string) => {
  const n = dayNumber(iso);
  return n - ((((n + 3) % 7) + 7) % 7);
};

/**
 * The weekly series from the dataset start to the replay date: one read on mount, again when the
 * date crosses into a new week, goes backwards (a seek or reset: later days must not show), or,
 * after a pause of 1.2 s, moves on inside the same week (the partial week stays current while
 * stepping, but playing does not cause a request per tick).
 */
export function useWeekly(client: AeiClient | undefined, start: string | undefined, asOf: string | undefined): WeeklyResponse | null {
  const [data, setData] = useState<WeeklyResponse | null>(null);
  const have = useRef<WeeklyResponse | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!client || !start || !asOf) return;
    // The same window (from and replay date) is already asked for or shown: a new client object does not ask again.
    const windowKey = `${start}|${asOf}`;
    if (windowKey === asked.current) return;
    asked.current = windowKey;
    const cur = have.current;
    const load = (attempt: number, mine: number) => {
      client
        .weekly({ from: start })
        .then((r) => {
          if (mine !== generation.current) return;
          have.current = r;
          setData(r);
        })
        .catch(() => {
          if (mine !== generation.current) return;
          timer.current = setTimeout(() => load(attempt + 1, mine), backoffDelay(attempt));
        });
    };
    const fetchNow = (wait: number) => {
      if (timer.current) clearTimeout(timer.current);
      const mine = ++generation.current;
      if (wait > 0) timer.current = setTimeout(() => load(0, mine), wait);
      else load(0, mine);
    };
    if (!cur) fetchNow(0);
    else if (asOf < cur.asOf || mondayOf(asOf) > mondayOf(cur.asOf)) fetchNow(0);
    else if (asOf > cur.asOf) fetchNow(1200);
  }, [client, start, asOf]);

  // On unmount (and React's development double-mount) the pending answer is dropped, so the window must be
  // asked for again when the effect next runs; otherwise the band would stay empty.
  useEffect(
    () => () => {
      generation.current++;
      asked.current = null;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return data;
}
