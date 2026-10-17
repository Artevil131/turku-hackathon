import type { AeiClient, Alert, ClockCommand } from "@aei/contract";
import { PHENOTYPES, type Phenotype, type WardCode } from "@aei/domain";
import type { Locale } from "@aei/i18n";
import type { Finding } from "../../live.ts";
import { knownWard } from "../../sites.ts";
import { hashParams } from "../../url.ts";

// Shared state and props of the researcher's board (spec-research.md). The
// shell (ResearchBoard.tsx) owns the state and the URL; panels only read it
// and ask for changes through `onChange`.

/** The centre view: the geographic panel (default) or the unit grid. Old links to `network` and `map` open the geographic panel. */
export type Panel = "geo" | "grid";
export const PANELS: readonly Panel[] = ["geo", "grid"];

/** The five kinds of ENGINE.md 3.6; naming is a lookup on the alert. */
export type SignalKind = "sentinel" | "cluster" | "trend" | "divergence" | "data";
export const KINDS: readonly SignalKind[] = ["sentinel", "cluster", "trend", "divergence", "data"];

export function kindOf(alert: Alert): SignalKind | null {
  if (alert.kind === "cpe" || alert.kind === "new-in-unit") return "sentinel";
  if (alert.kind === "carrier") return null;
  switch (alert.detector) {
    case "profile-excess":
    case "phenotype-excess":
      return "cluster";
    case "rising-trend":
      return "trend";
    case "sampling-drop":
    case "empty-run":
      return "data";
  }
}

export const GRID_WEEKS = [12, 26, 52] as const;
export type GridWeeks = (typeof GRID_WEEKS)[number];
export const DEFAULT_WEEKS: GridWeeks = 12;

export interface BoardState {
  panel: Panel;
  /** The unit grid's window in weeks; 12 is the default and stays out of the URL. */
  weeks: GridWeeks;
  /** Filters the feed and highlights the unit in every panel. */
  unit: WardCode | null;
  kinds: SignalKind[];
  phenotype: Phenotype | null;
  /** The selected incident (its `incident` id, or the alert id); `#research?inc=` or `?incident=`. */
  incident: string | null;
  /** The unit of the open incident: highlighted by panels, never filters the feed. */
  focus: WardCode | null;
}

export function boardFromUrl(): BoardState {
  const p = hashParams();
  const panel = p.get("panel");
  const unit = p.get("unit");
  const ph = p.get("ph");
  const focus = p.get("focus");
  const weeks = Number(p.get("weeks"));
  return {
    weeks: GRID_WEEKS.find((w) => w === weeks) ?? DEFAULT_WEEKS,
    panel: panel === "grid" ? "grid" : "geo",
    unit: unit && knownWard(unit) ? unit : null,
    kinds: (p.get("kind") ?? "").split(",").filter((k): k is SignalKind => KINDS.includes(k as SignalKind)),
    phenotype: PHENOTYPES.includes(ph as Phenotype) ? (ph as Phenotype) : null,
    incident: p.get("inc") ?? p.get("incident"),
    focus: focus && knownWard(focus) ? focus : null,
  };
}

export function boardToParams(s: BoardState): Record<string, string | null> {
  // The default panel stays out of the URL, so a link that names one is a deliberate choice.
  return {
    panel: s.panel === "geo" ? null : s.panel,
    weeks: s.weeks === DEFAULT_WEEKS ? null : String(s.weeks),
    unit: s.unit,
    kind: s.kinds.join(",") || null,
    ph: s.phenotype,
    inc: s.incident,
    focus: s.focus,
  };
}

/** What every panel receives. */
export interface PanelProps {
  client: AeiClient;
  locale: Locale;
  /** The replay clock's date; null while connecting. */
  asOf: string | null;
  state: BoardState;
  onChange: (patch: Partial<BoardState>) => void;
  reducedMotion: boolean;
  /** The units the selected signal reaches (its span chips): the kin marks of the grid and the flow. */
  kin?: WardCode[];
  /** An incident is selected: panels dim what is not it or its kin. */
  hasSelection?: boolean;
}

/** The feed also gets the live findings, to mark isolates seen. */
export interface FeedProps extends PanelProps {
  findings: Finding[];
  acknowledge: (ids: string[]) => void;
  /** The clock command (App's `live.command`): the signal card seeks to its day with it. */
  command?: (c: ClockCommand) => void;
}
