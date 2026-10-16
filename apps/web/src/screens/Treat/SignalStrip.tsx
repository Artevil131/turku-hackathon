import { useMemo } from "react";
import { groupEpisodes } from "../../engine/episodes.ts";
import type { Severity, Signal } from "../../engine/types.ts";
import type { FeedMeta } from "../../feed/types.ts";
import { formatDate, formatNumber, t, type Locale } from "../../i18n/index.ts";
import { Icon } from "../../ui/index.ts";
import { SIGNAL_LINES } from "./model.ts";
import { signalSentence } from "./text.tsx";

// Recent deviations on the doctor's unit, one plain line per episode (an
// outbreak's cluster, surge and shifts are one line). At most SIGNAL_LINES
// lines, then "+N more" to the Alerts screen.

const GLYPH: Record<Severity, string> = { high: "▲", medium: "◆", low: "●" };

export function SignalStrip({
  locale,
  meta,
  signals,
  ward,
  min,
  onOpenSignal,
}: {
  locale: Locale;
  meta: FeedMeta;
  signals: readonly Signal[];
  ward: string;
  min: number;
  onOpenSignal: (id: string) => void;
}) {
  const episodes = useMemo(() => groupEpisodes(signals), [signals]);
  if (episodes.length === 0) return null;
  const shown = episodes.slice(0, SIGNAL_LINES);
  const rest = episodes.length - shown.length;
  return (
    <section className="treat-signals" aria-label={t(locale, "treat.signals.label")}>
      <ul className="treat-signals-list">
        {shown.map((e) => {
          const s = e.lead;
          const linked = e.members.length - 1;
          return (
            <li key={e.id}>
              <button type="button" className={`treat-signal is-${s.severity}`} onClick={() => onOpenSignal(s.id)}>
                <span className="treat-signal-glyph" aria-hidden="true">
                  {GLYPH[s.severity]}
                </span>
                <span className="u-sr">{t(locale, `common.severity.${s.severity}`)}: </span>
                <span className="treat-signal-text">
                  <span className="treat-signal-sentence">{signalSentence(locale, meta, s, ward, min)}</span>
                  <span className="treat-signal-when u-num">
                    {t(locale, "treat.signals.since", { date: formatDate(locale, e.firstDate) })}
                    {linked > 0
                      ? ` · ${linked === 1 ? t(locale, "treat.signals.linkedOne") : t(locale, "treat.signals.linked", { count: formatNumber(locale, linked) })}`
                      : ""}
                  </span>
                </span>
                <Icon name="chevron-right" size={18} className="treat-signal-chev" />
              </button>
            </li>
          );
        })}
      </ul>
      {rest > 0 ? (
        <a className="treat-signals-more" href="#alerts">
          {rest === 1 ? t(locale, "treat.signals.moreOne") : t(locale, "treat.signals.more", { count: formatNumber(locale, rest) })}
          <Icon name="arrow-right" size={16} />
        </a>
      ) : null}
    </section>
  );
}
