import { GLOSSARY, type GlossTerm, type Locale } from "@aei/i18n";

// One abbreviation with its gloss (research-unified.md §6). The title shows the long form and
// the meaning on hover; the aria-label and aria-description carry the same for screen readers (an abbr is not a control, so it takes no focus).
// `first` spells the long form out after the abbreviation: use it once per card.
export function Gloss({
  term,
  locale,
  first = false,
  children,
}: {
  term: GlossTerm;
  locale: Locale;
  first?: boolean;
  /** The words to show when the sentence inflects the term (Finnish); defaults to the term itself. */
  children?: string;
}) {
  const { long, meaning } = GLOSSARY[locale][term];
  return (
    <>
      <abbr className="gloss" title={`${long} · ${meaning}`} aria-label={`${term}, ${long}`} aria-description={meaning}>
        {children ?? term}
      </abbr>
      {first ? (
        <>
          {" "}
          <span className="gloss-long">({long})</span>
        </>
      ) : null}
    </>
  );
}
