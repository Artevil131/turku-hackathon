import { t } from "@aei/i18n";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { hashParams, writeHashParams } from "../../url.ts";
import { type BoardState, boardFromUrl, boardToParams, type FeedProps, PANELS, type Panel } from "./board.ts";
import { HospitalNetwork } from "./HospitalNetwork.tsx";
import { RegionalMap } from "./RegionalMap.tsx";
import { SignalFeed } from "./SignalFeed.tsx";
import { UnitGrid } from "./UnitGrid.tsx";
import "./ResearchBoard.css";

// The researcher's board (spec-research.md): the signal feed always on the
// left, one of grid / network / map on the right, linked through one state
// that lives in the URL. Under 1100 px the feed becomes the first of four
// tabs and stays mounted so an open incident survives a tab switch.

type Tab = "feed" | Panel;

type Props = Omit<FeedProps, "state" | "onChange">;

const PANEL_LABEL = { grid: "boardGrid", network: "boardNetwork", map: "boardMap" } as const;
const PANEL_SHORT = { grid: "boardGridShort", network: "boardNetworkShort", map: "boardMapShort" } as const;

const WIDE = "(min-width: 1100px)";

function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mql = window.matchMedia(WIDE);
    const onChange = () => setWide(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export function ResearchBoard(props: Props) {
  const { locale } = props;
  const [state, setState] = useState<BoardState>(boardFromUrl);
  // Narrow screens only: which tab is showing. Wide screens show the feed and `state.panel`.
  // Narrow screens open the panel a link names, unless it also names an incident (that lives in the feed).
  const [tab, setTab] = useState<Tab>(() => {
    const p = hashParams();
    return p.has("panel") && !p.has("inc") ? boardFromUrl().panel : "feed";
  });
  const onChange = useCallback((patch: Partial<BoardState>) => setState((s) => ({ ...s, ...patch })), []);
  useEffect(() => writeHashParams(boardToParams(state)), [state]);
  // A link followed inside the app (or the back button) changes the hash without remounting.
  useEffect(() => {
    const onHash = () => setState(boardFromUrl());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const wide = useWide();
  const panelProps = { ...props, state, onChange };
  const tabs: Tab[] = ["feed", ...PANELS];
  const label = (x: Tab) => t(locale, x === "feed" ? "boardFeed" : PANEL_LABEL[x]);
  const choose = (x: Tab) => {
    setTab(x);
    if (x !== "feed") onChange({ panel: x });
  };

  const selected: Tab = wide ? state.panel : tab;
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  // Roving tabindex: one tab stop; arrows, Home and End move and select (the panel swap is instant).
  const onTabKey = (e: KeyboardEvent, x: Tab) => {
    const order = wide ? PANELS : tabs;
    const i = order.indexOf(x as Panel);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % order.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + order.length) % order.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = order.length - 1;
    const to = next === null ? undefined : order[next];
    if (to === undefined) return;
    e.preventDefault();
    choose(to);
    tabRefs.current.get(to)?.focus();
  };

  return (
    <div className="section board">
      <div className="board-tabs" role="tablist" aria-label={t(locale, "boardPanels")}>
        {tabs.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            id={`board-tab-${x}`}
            className="board-tab"
            data-panel={x}
            aria-selected={selected === x}
            aria-controls={x === "feed" ? "board-panel-feed" : "board-panel-main"}
            tabIndex={selected === x ? 0 : -1}
            ref={(el) => {
              if (el) tabRefs.current.set(x, el);
              else tabRefs.current.delete(x);
            }}
            onKeyDown={(e) => onTabKey(e, x)}
            onClick={() => choose(x)}
          >
            {x === "feed" ? (
              label(x)
            ) : (
              <>
                <span className="board-tab-long">{label(x)}</span>
                <span className="board-tab-short" aria-hidden="true">
                  {t(locale, PANEL_SHORT[x])}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <div
        className="board-feed"
        id="board-panel-feed"
        {...(wide ? {} : { role: "tabpanel", "aria-labelledby": "board-tab-feed" })}
        data-shown={wide || tab === "feed"}
      >
        <SignalFeed {...panelProps} />
      </div>
      <div
        className="board-main"
        id="board-panel-main"
        role="tabpanel"
        aria-labelledby={`board-tab-${state.panel}`}
        data-shown={wide || tab !== "feed"}
      >
        {state.panel === "grid" ? <UnitGrid {...panelProps} /> : null}
        {state.panel === "network" ? <HospitalNetwork {...panelProps} /> : null}
        {state.panel === "map" ? <RegionalMap {...panelProps} /> : null}
      </div>
    </div>
  );
}
