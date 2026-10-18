// A tour is offered on its own at most once per browser session; the Guide button and "Take the tour" always work.
const KEY = "yl.tourOffered";

/** True the first time it is asked in this session, false afterwards. Storage that throws counts as already offered. */
export function offerOnce(): boolean {
  try {
    if (sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, "1");
    return true;
  } catch {
    return false;
  }
}
