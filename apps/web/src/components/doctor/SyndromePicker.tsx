import { guide, type Syndrome, type SyndromeId } from "@aei/guideline";
import { type Locale, specimenName, t } from "@aei/i18n";
import { SITES } from "./filters.ts";
import "./SyndromePicker.css";

interface Props {
  locale: Locale;
  value: SyndromeId | null;
  /** The chosen syndrome; the chosen one again clears it (the filters stay). */
  onPick: (syndrome: Syndrome | null) => void;
}

/**
 * The hospital guide's syndromes as one row of chips, grouped by specimen (D-047). Choosing one sets the record
 * strip's specimen, severity and onset; it marks the guide's first choice on the list and never reorders it.
 * On phones the row scrolls sideways.
 */
export function SyndromePicker({ locale, value, onPick }: Props) {
  const g = guide();
  const groups = SITES.map((site) => ({ site, syndromes: g.syndromes.filter((s) => s.specimen === site) })).filter(
    (group) => group.syndromes.length > 0,
  );
  return (
    <nav className="syn" aria-label={t(locale, "drSyndrome")} title={t(locale, "drSyndromeHint")}>
      <span className="syn-label">{t(locale, "drSyndrome")}</span>
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
    </nav>
  );
}
