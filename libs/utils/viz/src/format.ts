// Number formats for the signal charts. Pure, no React.

/** p for display: plain when ≥ 0.001, else a × 10^n form. */
export function formatP(p: number, locale: string): string {
  if (p >= 0.001) return p.toLocaleString(locale, { maximumSignificantDigits: 2 });
  const [m, e] = p.toExponential(1).split("e");
  const mant = Number(m).toLocaleString(locale, { minimumFractionDigits: 1 });
  const exp = String(Number(e)).replace("-", "−");
  return `${mant} × 10^${exp}`;
}

const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "−": "⁻",
};

/** `formatP` with a superscript exponent. */
export function formatPSup(p: number, locale: string): string {
  return formatP(p, locale).replace(/\^(.+)$/, (_, e: string) => [...e].map((c) => SUP[c] ?? c).join(""));
}

/** A count or expected value: one decimal from 10 up, two below. */
export function formatNum(n: number, locale: string): string {
  const digits = Math.abs(n) >= 10 ? 1 : 2;
  return n.toLocaleString(locale, { maximumFractionDigits: digits });
}
