import { t } from "@aei/i18n";
import { useCallback, useEffect, useState } from "react";
import { writeHashParams } from "../../url.ts";
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
  const [tab, setTab] = useState<Tab>("feed");
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

  return (
    <div className="section board">
      <div className="board-tabs" role="tablist" aria-label={t(locale, "boardPanels")}>
        {tabs.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            className="board-tab"
            data-panel={x}
            aria-selected={wide ? state.panel === x : tab === x}
            onClick={() => choose(x)}
          >
            {label(x)}
          </button>
        ))}
      </div>
      <div className="board-feed" data-shown={wide || tab === "feed"}>
        <SignalFeed {...panelProps} />
      </div>
      <div className="board-main" data-shown={wide || tab !== "feed"}>
        {state.panel === "grid" ? <UnitGrid {...panelProps} /> : null}
        {state.panel === "network" ? <HospitalNetwork {...panelProps} /> : null}
        {state.panel === "map" ? <RegionalMap {...panelProps} /> : null}
      </div>
    </div>
  );
}
