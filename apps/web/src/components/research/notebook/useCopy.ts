import { useCallback, useEffect, useRef, useState } from "react";

/** Copies text; "manual" when the clipboard is refused (the text stays selectable). Resets after 1.8 s. */
export function useCopy(): ["idle" | "copied" | "manual", (text: string) => Promise<boolean>] {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (text: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    setState(ok ? "copied" : "manual");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
    return ok;
  }, []);
  return [state, copy];
}
