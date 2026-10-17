import type { ReactNode } from "react";
import type { IsoDate } from "../feed/types.ts";
import type { FeedStatus } from "../feed/useFeed.ts";
import { formatDate, formatNumber, type Locale, type MessageKey, t } from "../i18n/index.ts";
import { Icon, type IconName, Mark } from "./Icon.tsx";

/*
  The shell's parts (used only by App.tsx):
    Header      wordmark + tagline, freshness chip, top tabs (>= 1024 px), Ask, settings
    TabBar      bottom tabs on phones (< 1024 px), labelled icons, Alerts badge, safe-area insets
    FreshChip   "Results up to 12 May 2025" with a live dot (green live, amber connecting, grey offline)
  Routes are hash links (#treat, #alerts, #report, #timeline, #settings).
*/

export type Route = "treat" | "alerts" | "report" | "timeline" | "settings";
export const TABS: readonly { route: Route; icon: IconName; key: MessageKey }[] = [
  { route: "treat", icon: "treat", key: "common.tab.treat" },
  { route: "alerts", icon: "alerts", key: "common.tab.alerts" },
  { route: "report", icon: "report", key: "common.tab.report" },
  { route: "timeline", icon: "timeline", key: "common.tab.timeline" },
];

export function FreshChip({
  locale,
  status,
  asOf,
  arrivalSeq,
  checking,
  short,
}: {
  locale: Locale;
  status: FeedStatus;
  asOf: IsoDate | null;
  /** Changes with each arrival: replays the dot's pulse. */
  arrivalSeq: number;
  checking: boolean;
  short: boolean;
}) {
  const stateText =
    status === "live"
      ? t(locale, "common.fresh.live")
      : status === "connecting"
        ? t(locale, "common.fresh.connecting")
        : t(locale, "common.fresh.offline");
  return (
    <div className={`app-fresh is-${status}`} title={checking ? `${stateText}. ${t(locale, "common.fresh.checking")}` : stateText}>
      <span key={arrivalSeq} className="app-fresh-dot" aria-hidden="true" />
      <span className="app-fresh-text u-num">
        {asOf
          ? short
            ? t(locale, "common.fresh.upToShort", { date: formatDate(locale, asOf) })
            : t(locale, "common.fresh.upTo", { date: formatDate(locale, asOf, "long") })
          : stateText}
      </span>
      <span className="u-sr">. {stateText}</span>
      {status === "offline" ? <Icon name="wifi-off" size={14} /> : null}
    </div>
  );
}

function TabLink({
  route,
  icon,
  label,
  current,
  badge,
  badgeLabel,
  variant,
}: {
  route: Route;
  icon: IconName;
  label: string;
  current: boolean;
  badge?: number;
  badgeLabel?: string;
  variant: "top" | "bottom";
}) {
  return (
    <a href={`#${route}`} className={`app-tab is-${variant}${current ? " is-on" : ""}`} aria-current={current ? "page" : undefined}>
      <span className="app-tab-icon">
        <Icon name={icon} size={variant === "bottom" ? 22 : 18} />
        {badge ? (
          <span className="app-tab-badge u-num" aria-hidden="true">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span className="app-tab-label">{label}</span>
      {badge ? <span className="u-sr">, {badgeLabel}</span> : null}
    </a>
  );
}

export function Tabs({
  locale,
  route,
  alertsBadge,
  variant,
}: {
  locale: Locale;
  route: Route;
  alertsBadge: number;
  variant: "top" | "bottom";
}) {
  return (
    <nav className={`app-tabs is-${variant}`} aria-label={t(locale, "common.tab.nav")}>
      {TABS.map((tab) => (
        <TabLink
          key={tab.route}
          route={tab.route}
          icon={tab.icon}
          label={t(locale, tab.key)}
          current={route === tab.route}
          badge={tab.route === "alerts" ? alertsBadge : undefined}
          badgeLabel={t(locale, "common.tab.badge", { count: formatNumber(locale, alertsBadge) })}
          variant={variant}
        />
      ))}
    </nav>
  );
}

export function Header({
  locale,
  route,
  desktop,
  fresh,
  alertsBadge,
  ask,
  demoPeriod,
}: {
  locale: Locale;
  route: Route;
  desktop: boolean;
  fresh: ReactNode;
  alertsBadge: number;
  /** The Ask button, only when the AI layer is available. */
  ask: ReactNode;
  demoPeriod?: string;
}) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a href="#treat" className="app-brand" aria-label={`${t(locale, "common.app.name")}: ${t(locale, "common.app.fullName")}`}>
          <Mark size={30} />
          <span className="app-brand-texts" aria-hidden="true">
            <span className="app-brand-name">{t(locale, "common.app.name")}</span>
            <span className="app-brand-tag">{t(locale, "common.app.tagline")}</span>
          </span>
        </a>
        {desktop ? <Tabs locale={locale} route={route} alertsBadge={alertsBadge} variant="top" /> : null}
        <div className="app-header-tools">
          {fresh}
          {ask}
          <a
            href="#settings"
            className={`k-iconbtn app-gear${route === "settings" ? " is-on" : ""}`}
            aria-label={t(locale, "common.tab.settings")}
            aria-current={route === "settings" ? "page" : undefined}
          >
            <Icon name="settings" size={22} />
          </a>
        </div>
      </div>
      {demoPeriod ? <p className="app-demo-period u-num">{demoPeriod}</p> : null}
    </header>
  );
}
