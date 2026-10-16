import type { AeiClient, Alert } from "@aei/contract";
import { isWardCode, PHENOTYPES, type Phenotype, type WardCode } from "@aei/domain";
import type { Locale } from "@aei/i18n";
import type { Finding } from "../../live.ts";
import { hashParams } from "../../url.ts";

// Shared state and props of the researcher's board (spec-research.md). The
// shell (ResearchBoard.tsx) owns the state and the URL; panels only read it
// and ask for changes through `onChange`.

export type Panel = "grid" | "network" | "map";
export const PANELS: readonly Panel[] = ["grid", "network", "map"];

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

export interface BoardState {
  panel: Panel;
  /** Filters the feed and highlights the unit in every panel. */
  unit: WardCode | null;
  kinds: SignalKind[];
  phenotype: Phenotype | null;
  /** The open incident in the feed (its `incident` id, or the alert id). */
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
  return {
    panel: PANELS.includes(panel as Panel) ? (panel as Panel) : "grid",
    unit: unit && isWardCode(unit) ? unit : null,
    kinds: (p.get("kind") ?? "").split(",").filter((k): k is SignalKind => KINDS.includes(k as SignalKind)),
    phenotype: PHENOTYPES.includes(ph as Phenotype) ? (ph as Phenotype) : null,
    incident: p.get("inc"),
    focus: focus && isWardCode(focus) ? focus : null,
  };
}

export function boardToParams(s: BoardState): Record<string, string | null> {
  return { panel: s.panel, unit: s.unit, kind: s.kinds.join(",") || null, ph: s.phenotype, inc: s.incident, focus: s.focus };
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
}

/** The feed also gets the live findings, to mark isolates seen. */
export interface FeedProps extends PanelProps {
  findings: Finding[];
  acknowledge: (ids: string[]) => void;
}
