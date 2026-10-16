import type { ClockCommand, ClockState } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import type { ReactNode } from "react";
import type { Connection } from "../live.ts";
import { Gear, Mark, Pause, Play, StepDay } from "./Icons.tsx";

export type Page = "home" | "doctor" | "research" | "settings";

interface Props {
  locale: Locale;
  page: Page;
  onPage: (p: Page) => void;
  unseen: number;
  clock: ClockState | null;
  connection: Connection;
  lastArrivals: { to: string; count: number } | null;
  command: (c: ClockCommand) => void;
}

export function TopBar(props: Props) {
  const { locale, page, clock, connection } = props;
  const tab = (p: Page, label: string, extra?: ReactNode) => (
    <button type="button" className="section-tab" aria-current={page === p ? "page" : undefined} onClick={() => props.onPage(p)}>
      {label}
      {extra}
    </button>
  );
  return (
    <header className="topbar glass ply-1">
      <button type="button" className="mark" onClick={() => props.onPage("home")} aria-label={t(locale, "home")}>
        <Mark className="mark-glyph" />
        <span>
          <span className="mark-name">{t(locale, "appName")}</span>
          <span className="mark-sub">{t(locale, "appTagline")}</span>
        </span>
      </button>

      <nav className="sections" aria-label={t(locale, "sections")}>
        {tab("home", t(locale, "home"))}
        {tab("doctor", t(locale, "roleDoctor"))}
        {tab(
          "research",
          t(locale, "roleResearch"),
          props.unseen > 0 ? (
            <span className="badge num" title={t(locale, "unseenN", { n: props.unseen })}>
              {props.unseen}
            </span>
          ) : null,
        )}
      </nav>

      <div className="top-tools">
        <div className="clock-mini" title={t(locale, "replayNote")}>
          <span className="pulse" data-on={connection === "open" && Boolean(clock?.running)} />
          <span className="clock-mini-text">
            {connection === "offline" ? (
              <span className="offline">{t(locale, "offlineShort")}</span>
            ) : clock ? (
              <>
                <b className="num">{t(locale, "asOf", { date: formatDate(locale, clock.asOf, "long") })}</b>
                {props.lastArrivals ? <span className="muted"> · {t(locale, "arrivalsN", { n: props.lastArrivals.count })}</span> : null}
              </>
            ) : (
              t(locale, "connecting")
            )}
          </span>
          <button
            type="button"
            className="icon-btn"
            disabled={connection !== "open"}
            onClick={() => props.command({ action: clock?.running ? "pause" : "play" })}
            aria-label={clock?.running ? t(locale, "pause") : t(locale, "play")}
            title={clock?.running ? t(locale, "pause") : t(locale, "play")}
          >
            {clock?.running ? <Pause /> : <Play />}
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={connection !== "open"}
            onClick={() => props.command({ action: "step", days: 1 })}
            aria-label={t(locale, "stepDay")}
            title={t(locale, "stepDay")}
          >
            <StepDay />
          </button>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => props.onPage("settings")}
          aria-label={t(locale, "settings")}
          title={t(locale, "settings")}
        >
          <Gear />
        </button>
      </div>
    </header>
  );
}
