import { guide, type Syndrome, type SyndromeId } from "@aei/guideline";
import { formatDate, type Locale, specimenName, t } from "@aei/i18n";
import { useState } from "react";
import { SITES } from "./filters.ts";
import "./SyndromePicker.css";

interface Props {
  locale: Locale;
  value: SyndromeId | null;
  /** The chosen syndrome; the chosen one again clears it (the filters stay). */
  onPick: (syndrome: Syndrome | null) => void;
  /** Narrow screens: the eleven chips wait behind one "Syndrome: choose" control instead of standing above the case controls. */
  compact?: boolean;
}

/**
 * The hospital guide's syndromes as one row of chips, grouped by specimen (D-047). Choosing one sets the record
 * strip's specimen, severity and onset; it marks the guide's first choice on the list and never reorders it.
 * On phones the row scrolls sideways.
 */
export function SyndromePicker({ locale, value, onPick, compact = false }: Props) {
  const g = guide();
  const [open, setOpen] = useState(false);
  const groups = SITES.map((site) => ({ site, syndromes: g.syndromes.filter((s) => s.specimen === site) })).filter(
    (group) => group.syndromes.length > 0,
  );
  const chosen = g.syndromes.find((s) => s.id === value);
  const chips = (
    <div className="syn-row">
      {groups.map(({ site, syndromes }) => (
        <div key={site} className="syn-group" role="group" aria-label={specimenName(locale, site)}>
          <span className="syn-site" aria-hidden="true">
            {specimenName(locale, site)}
          </span>
          {syndromes.map((s) => (
            <button
              key={s.id}
              type="button"
              className="syn-chip"
              data-syn={s.id}
              aria-pressed={value === s.id}
              onClick={() => onPick(value === s.id ? null : s)}
            >
              {s.name[locale]}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
  if (compact)
    return (
      <nav className="syn syn-compact" aria-label={t(locale, "drSyndrome")} title={t(locale, "drSyndromeHint")}>
        <button type="button" className="syn-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{chosen ? `${t(locale, "drSyndrome")}: ${chosen.name[locale]}` : t(locale, "drSyndromeChoose")}</span>
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
        {open ? chips : null}
      </nav>
    );
  // Where the list comes from, in view: the guide's own name links to the guide, so nobody wonders why these.
  const [before = "", after = ""] = t(locale, "drSyndromeSource", { guide: "\u0000", date: formatDate(locale, g.date, "long") }).split(
    "\u0000",
  );
  return (
    <nav className="syn" aria-label={t(locale, "drSyndrome")} title={t(locale, "drSyndromeHint")}>
      <span className="syn-label">{t(locale, "drSyndrome")}</span>
      <p className="syn-source">
        {before}
        <a href={g.url} target="_blank" rel="noreferrer">
          {g.title}
        </a>
        {after}
      </p>
      {chips}
    </nav>
  );
}
