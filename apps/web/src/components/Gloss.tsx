import { GLOSSARY, type GlossTerm, type Locale } from "@aei/i18n";

// One abbreviation with its gloss (research-unified.md §6). The title shows the long form and
// the meaning on hover; the abbr is focusable so keyboard users and screen readers get the same.
// `first` spells the long form out after the abbreviation: use it once per card.
export function Gloss({ term, locale, first = false }: { term: GlossTerm; locale: Locale; first?: boolean }) {
  const { long, meaning } = GLOSSARY[locale][term];
  return (
    <>
      <abbr className="gloss" title={`${long} · ${meaning}`} tabIndex={0} aria-label={`${term}, ${long}`}>
        {term}
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
