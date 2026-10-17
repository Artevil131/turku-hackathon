import type { FeedMeta } from "../../feed/types.ts";
import { formatDate, formatNumber, type Locale, t } from "../../i18n/index.ts";
import type { Severity, Signal } from "../../model/types.ts";
import { Icon } from "../../ui/index.ts";
import { SIGNAL_LINES } from "./model.ts";
import { signalSentence } from "./text.tsx";

// Recent deviations on the doctor's unit, one plain line each. At most
// SIGNAL_LINES lines, then "+N more" to the Alerts screen.

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
  if (signals.length === 0) return null;
  const shown = signals.slice(0, SIGNAL_LINES);
  const rest = signals.length - shown.length;
  return (
    <section className="treat-signals" aria-label={t(locale, "treat.signals.label")}>
      <ul className="treat-signals-list">
        {shown.map((s) => (
          <li key={s.id}>
            <button type="button" className={`treat-signal is-${s.severity}`} onClick={() => onOpenSignal(s.id)}>
              <span className="treat-signal-glyph" aria-hidden="true">
                {GLYPH[s.severity]}
              </span>
              <span className="u-sr">{t(locale, `common.severity.${s.severity}`)}: </span>
              <span className="treat-signal-text">
                <span className="treat-signal-sentence">{signalSentence(locale, meta, s, ward, min)}</span>
                <span className="treat-signal-when u-num">
                  {t(locale, "treat.signals.since", { date: formatDate(locale, s.firstDate) })}
                </span>
              </span>
              <Icon name="chevron-right" size={18} className="treat-signal-chev" />
            </button>
          </li>
        ))}
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
