/** Wait before retry number `attempt` (0 is the first retry): 2 s, 4 s, 8 s ... capped at 30 s. */
export function backoffDelay(attempt: number, baseMs = 2000, capMs = 30_000): number {
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(capMs, baseMs * 2 ** Math.min(n, 20));
}
