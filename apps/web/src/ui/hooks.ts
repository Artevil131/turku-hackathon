import { type Dispatch, type SetStateAction, useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
  Small shared hooks and storage helpers.
    useMedia(query)        live matchMedia result
    useIsDesktop()         >= 1024 px (two columns, popovers, top tabs)
    useReducedMotion()     prefers-reduced-motion
    store.get/set/remove   localStorage that never throws (private mode, blocked storage)
    useStored(key, init, valid?)  state remembered in localStorage under "aei.<key>" (the setter takes a value or an updater)
*/

export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export const useIsDesktop = () => useMedia(DESKTOP_QUERY);
export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");

const PREFIX = "aei.";

export const store = {
  get<T>(key: string): T | undefined {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw == null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* nothing to forget */
    }
  },
  /** Forget every remembered choice of this app. */
  clear(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(PREFIX)) keys.push(k);
      }
      for (const k of keys) window.localStorage.removeItem(k);
    } catch {
      /* nothing to forget */
    }
  },
};

/** State remembered on this device. `valid` rejects stale values (e.g. a unit no longer in the feed). */
export function useStored<T>(key: string, initial: T, valid?: (v: unknown) => v is T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const saved = store.get<unknown>(key);
    if (saved === undefined) return initial;
    if (valid && !valid(saved)) return initial;
    return saved as T;
  });
  const initialJson = useRef(JSON.stringify(initial));
  useEffect(() => {
    // The default is not stored, so "forget" really forgets and defaults can change later.
    if (JSON.stringify(value) === initialJson.current) store.remove(key);
    else store.set(key, value);
  }, [key, value]);
  return [value, setValue];
}
