import type { ReactNode } from "react";
import type { Share } from "../engine/types.ts";
import { formatNumber, formatShare, t, type Locale } from "../i18n/index.ts";

/*
  ShareBar: "works in X of N" as a percentage, a bar and the count it rests on.
  Below `min` (the organiser's 30 isolates) it never shows a percentage: it
  says "Too few (n)" with an empty, hatched track instead.
    locale      Locale
    share       Share { works, n }
    min?        number         default 30 (MIN_ISOLATES)
    label?      ReactNode      a leading name (e.g. the antibiotic) on the same row
    aside?      ReactNode      trailing node on the top row (a Badge, a change arrow)
    reference?  { share: Share; label: string }   a tick on the track (e.g. the past year), drawn only when it reaches min;
                                                  its text "Past year: 91 %" is shown under the bar
    tone?       "neutral" (default, the calm blue) | "good" | "fair" | "poor"
                screens decide the tone and must say the same thing in words nearby
    size?       "lg" | "md" (default) | "sm"   lg = the top match, 34 px figure
    caption?    ReactNode      replaces the default "works in X of N" line
*/

export const MIN_ISOLATES = 30;

export function ShareBar({
  locale,
  share,
  min = MIN_ISOLATES,
  label,
  aside,
  reference,
  tone = "neutral",
  size = "md",
  caption,
}: {
  locale: Locale;
  share: Share;
  min?: number;
  label?: ReactNode;
  aside?: ReactNode;
  reference?: { share: Share; label: string };
  tone?: "neutral" | "good" | "fair" | "poor";
  size?: "lg" | "md" | "sm";
  caption?: ReactNode;
}) {
  const { works, n } = share;
  const enough = n >= min && n > 0;
  const value = enough ? works / n : null;
  const refValue = reference && reference.share.n >= min && reference.share.n > 0 ? reference.share.works / reference.share.n : null;
  const num = (v: number) => formatNumber(locale, v);

  let figure: ReactNode;
  let line: ReactNode;
  if (n === 0) {
    figure = <span className="k-share-none">{t(locale, "common.share.none")}</span>;
    line = null;
  } else if (!enough) {
    figure = <span className="k-share-few">{t(locale, "common.share.tooFew", { n: num(n) })}</span>;
    line = t(locale, "common.share.tooFewHint", { min: num(min) });
  } else {
    figure = <span className="k-share-pct u-num">{formatShare(locale, value ?? 0)}</span>;
    line = t(locale, "common.share.works", { works: num(works), n: num(n) });
  }

  return (
    <div className={`k-share is-${size} tone-${tone}${enough ? "" : " is-few"}`}>
      <div className="k-share-top">
        {label !== undefined ? <span className="k-share-label">{label}</span> : null}
        <span className="k-share-figure">{figure}</span>
        {aside !== undefined ? <span className="k-share-aside">{aside}</span> : null}
      </div>
      <div className="k-share-track" aria-hidden="true">
        {value !== null ? <span className="k-share-fill" style={{ width: `${Math.max(1.5, value * 100)}%` }} /> : null}
        {refValue !== null ? <span className="k-share-ref" style={{ left: `${refValue * 100}%` }} /> : null}
      </div>
      <div className="k-share-meta u-num">
        {caption ?? line}
        {reference && refValue !== null ? (
          <span className="k-share-refline">
            <span className="k-share-reftick" aria-hidden="true" />
            {t(locale, "common.share.reference", { label: reference.label, percent: formatShare(locale, refValue) })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
