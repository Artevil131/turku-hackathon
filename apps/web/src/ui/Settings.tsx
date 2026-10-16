import { useState } from "react";
import type { FeedMeta, IsoDate } from "../feed/types.ts";
import { formatDate, formatNumber, t, type Locale } from "../i18n/index.ts";
import { Badge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { Icon } from "./Icon.tsx";
import { Segmented } from "./Segmented.tsx";
import { MIN_ISOLATES } from "./ShareBar.tsx";
import { Switch } from "./Switch.tsx";

/*
  Settings (route #settings): language, ranking preference, about the data,
  the optional AI's status, and forgetting what this device remembers.
    locale, onLocale(locale)
    rank: "access-first" | "coverage", onRank(rank)
    meta: FeedMeta | null, asOf: IsoDate | null, resultCount: number
    feedSource: string            where the feed is read from (shown to the user)
    ai: { available: boolean; model: string | null; checking: boolean }
    onCheckAi()                   check the language model again
    onForget()                    clear every remembered choice on this device
*/

export interface AiState {
  available: boolean;
  model: string | null;
  checking: boolean;
}

export function Settings({
  locale,
  onLocale,
  rank,
  onRank,
  meta,
  asOf,
  resultCount,
  feedSource,
  ai,
  onCheckAi,
  onForget,
}: {
  locale: Locale;
  onLocale: (locale: Locale) => void;
  rank: "access-first" | "coverage";
  onRank: (rank: "access-first" | "coverage") => void;
  meta: FeedMeta | null;
  asOf: IsoDate | null;
  resultCount: number;
  feedSource: string;
  ai: AiState;
  onCheckAi: () => void;
  onForget: () => void;
}) {
  const [forgotten, setForgotten] = useState(false);
  const d = (iso: string) => formatDate(locale, iso, "long");

  return (
    <div className="app-settings">
      <h1 className="app-page-title">{t(locale, "common.settings.title")}</h1>

      <Card pad="md">
        <Segmented<Locale>
          label={t(locale, "common.settings.language")}
          showLabel
          value={locale}
          onChange={onLocale}
          options={[
            { value: "fi", label: <span lang="fi">Suomi</span> },
            { value: "en", label: <span lang="en">English</span> },
          ]}
        />
      </Card>

      <Card pad="md">
        <Switch
          checked={rank === "access-first"}
          onChange={(on) => onRank(on ? "access-first" : "coverage")}
          label={t(locale, "common.settings.rank")}
          description={t(locale, "common.settings.rankWhy")}
        />
      </Card>

      <Card title={t(locale, "common.settings.data")} pad="md">
        <ul className="app-facts">
          <li>
            <Icon name="flask" size={18} />
            <span>{t(locale, "common.settings.feed", { source: feedSource })}</span>
          </li>
          {meta && asOf ? (
            <li>
              <Icon name="calendar" size={18} />
              <span className="u-num">{t(locale, "common.settings.range", { start: d(meta.start), end: d(meta.end), asOf: d(asOf) })}</span>
            </li>
          ) : null}
          <li>
            <Icon name="report" size={18} />
            <span className="u-num">{t(locale, "common.settings.count", { count: formatNumber(locale, resultCount) })}</span>
          </li>
          <li>
            <Icon name="play" size={18} />
            <span>
              <Badge tone="sim" glyph={false} size="sm">
                {t(locale, "common.sim.label")}
              </Badge>{" "}
              {t(locale, "common.settings.sim")}
            </span>
          </li>
          <li>
            <Icon name="users" size={18} />
            <span>{t(locale, "common.settings.rules", { min: MIN_ISOLATES })}</span>
          </li>
          <li>
            <Icon name="shield" size={18} />
            <span className="u-strong">{t(locale, "common.settings.decide")}</span>
          </li>
        </ul>
      </Card>

      <Card title={t(locale, "common.settings.ai")} pad="md">
        <div className="u-spread app-ai-row">
          <span className="u-row">
            <Badge tone={ai.available ? "access" : "neutral"} size="sm">
              {ai.available
                ? ai.model
                  ? t(locale, "common.settings.aiOn", { model: ai.model })
                  : t(locale, "common.settings.aiOnPlain")
                : t(locale, "common.settings.aiOff")}
            </Badge>
          </span>
          <button type="button" className="k-btn is-secondary is-sm" onClick={onCheckAi} disabled={ai.checking} aria-busy={ai.checking}>
            <Icon name="refresh" size={16} />
            {ai.checking ? t(locale, "common.settings.aiChecking") : t(locale, "common.settings.aiCheck")}
          </button>
        </div>
        <p className="u-muted u-small app-ai-note">{t(locale, "common.ask.note")}</p>
      </Card>

      <Card title={t(locale, "common.settings.forget")} pad="md">
        <p className="u-soft">{t(locale, "common.settings.forgetBody")}</p>
        <div className="u-row app-forget-row">
          <button
            type="button"
            className="k-btn is-secondary"
            onClick={() => {
              onForget();
              setForgotten(true);
            }}
          >
            {t(locale, "common.settings.forgetButton")}
          </button>
          {forgotten ? (
            <span className="u-muted u-small" role="status">
              {t(locale, "common.settings.forgotten")}
            </span>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
