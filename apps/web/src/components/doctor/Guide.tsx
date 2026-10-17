import type { AntibioticCode } from "@aei/domain";
import { type Choice, firstChoiceCodes, guide, type Route, type Syndrome } from "@aei/guideline";
import { antibioticName, type Locale, type MessageKey, t } from "@aei/i18n";
import { dmy, pct } from "./filters.ts";
import type { Item } from "./reason.ts";

// The hospital guide beside the data (D-047): a marker on the rows the guide names as first choice, one line per
// first choice giving its coverage against the bar, and the guide's own words in a row's details. The guide never
// adds a row or changes the order.

const ROUTE: Record<Route, MessageKey> = { po: "drRoutePo", iv: "drRouteIv", "po/iv": "drRoutePoIv" };

/** The first-choice antibiotics of the syndrome that the list can carry; empty without a syndrome. */
export function guideCodes(syndrome: Syndrome | null | undefined): ReadonlySet<string> {
  return new Set<string>(syndrome ? firstChoiceCodes(syndrome) : []);
}

/** A choice's drug name without the dose: the guide's text up to the first figure ("ertapenem 1 g × 1 iv" → "ertapenem"). */
export function choiceName(locale: Locale, choice: Choice): string {
  if (choice.drug) return antibioticName(locale, choice.drug);
  return (choice.text[locale].match(/^[^\d(,]+/)?.[0] ?? choice.text[locale]).trim();
}

/** One line per first choice the list carries, and one for the drugs the guide names that the laboratory does not test. */
export function guideLines(locale: Locale, syndrome: Syndrome, singles: Item[], bar: number): { lines: string[]; also: string | null } {
  const g = guide();
  const head = { title: g.title, date: dmy(g.date), page: syndrome.source.page };
  const lines = firstChoiceCodes(syndrome).map((code) => {
    const item = singles.find((i) => i.id === code);
    const drug = antibioticName(locale, code);
    if (!item) return t(locale, "drGuideNotListed", { ...head, drug });
    const share = item.standing !== "not assessable" && item.share !== null ? pct(item.share) : "–";
    return t(locale, "drGuideLine", { ...head, drug, share, bar });
  });
  const textOnly = [...new Set(syndrome.firstChoices.filter((c) => !c.drug).map((c) => choiceName(locale, c)))];
  return { lines, also: textOnly.length ? t(locale, "drGuideAlso", { list: textOnly.join(", ") }) : null };
}

/** Under the list header: the legend for the marker, the guide's lines and a link to the guide. Nothing without a syndrome. */
export function GuideSummary({
  locale,
  syndrome,
  singles,
  bar,
}: {
  locale: Locale;
  syndrome: Syndrome | null | undefined;
  singles: Item[];
  bar: number;
}) {
  if (!syndrome) return null;
  const g = guide();
  const { lines, also } = guideLines(locale, syndrome, singles, bar);
  return (
    <div className="cl-guide-sum" aria-label={syndrome.name[locale]}>
      <p className="cl-guide-legend">
        <span className="cl-guide">{t(locale, "drGuideMark")}</span>{" "}
        {t(locale, "drGuideLegend", { syndrome: syndrome.name[locale].toLowerCase() })}
      </p>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {also ? <li>{also}</li> : null}
      </ul>
      <a href={g.url} target="_blank" rel="noopener noreferrer">
        {t(locale, "drGuideOpen")} <span className="dp-sr">{t(locale, "drGuideNewTab")}</span>
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

const choiceText = (locale: Locale, c: Choice) => `${c.text[locale]} (${t(locale, ROUTE[c.route])})`;

/** In a guide-marked row's details: the guide's dose text and route, the duration and the beta-lactam-allergy alternative. */
export function GuideDetails({ locale, syndrome, code }: { locale: Locale; syndrome: Syndrome | null | undefined; code: AntibioticCode }) {
  if (!syndrome || !guideCodes(syndrome).has(code)) return null;
  const choices = syndrome.firstChoices.filter((c) => c.drug === code);
  return (
    <div className="dt-guide">
      <h4>
        <span className="cl-guide">{t(locale, "drGuideMark")}</span> {syndrome.name[locale]}
      </h4>
      {choices.map((c) => (
        <p key={c.text.en}>
          {t(locale, "drGuideNames", { section: syndrome.source.section, page: syndrome.source.page, text: c.text[locale] })} ·{" "}
          {t(locale, "drGuideRoute", { route: t(locale, ROUTE[c.route]) })}
        </p>
      ))}
      {syndrome.duration ? <p>{t(locale, "drGuideDuration", { text: syndrome.duration[locale] })}</p> : null}
      {syndrome.allergyAlternative?.length ? (
        <p>{t(locale, "drGuideAllergy", { list: syndrome.allergyAlternative.map((c) => choiceText(locale, c)).join("; ") })}</p>
      ) : null}
    </div>
  );
}
