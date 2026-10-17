import { useEffect, useState } from "react";

const matches = (query: string) =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;

/** True while the media query matches; false where there is no window (server rendering, tests). */
export function useMedia(query: string): boolean {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setValue(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return value;
}
