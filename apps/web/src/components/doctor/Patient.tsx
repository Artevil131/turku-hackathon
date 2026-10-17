import type { PatientFinding, PatientFindingsResponse } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import { carrierRule, type Syndrome } from "@aei/guideline";
import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import type { ListStatus } from "./CoverageList.tsx";
import { dmy } from "./filters.ts";
import type { Item, Prior } from "./reason.ts";

// The patient's prior resistant finding (D-050): typed or scanned id, never stored. The findings and the guide's
// carrier rule are shown; rows the finding makes resistant are annotated and moved below the unaffected rows of their
// standing. No share changes.

export interface PatientState {
  status: ListStatus;
  response: PatientFindingsResponse | null;
}

/** The findings newest first. */
export function newestFirst(findings: readonly PatientFinding[]): PatientFinding[] {
  return [...findings].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const STANDINGS: readonly Item["standing"][] = ["clears", "borderline", "below", "not assessable"];

/** The newest finding whose phenotype `@aei/eucast` infers resistance to one of the antibiotics from, if any. */
export function priorFor(response: PatientFindingsResponse | null | undefined, codes: readonly string[]): Prior | null {
  if (!response) return null;
  for (const f of newestFirst(response.findings)) {
    const affected = response.affects[f.phenotype] ?? [];
    if (codes.some((c) => (affected as readonly string[]).includes(c))) return { phenotype: f.phenotype, date: f.date };
  }
  return null;
}

/**
 * Singles annotated with the patient's finding and, within each standing, the affected ones placed after the
 * unaffected ones (D-050); otherwise the server's order. Shares are untouched. Pairs are annotated, not moved.
 */
export function withPrior(
  singles: Item[],
  pairs: Item[],
  response: PatientFindingsResponse | null | undefined,
): { singles: Item[]; pairs: Item[] } {
  if (!response || response.findings.length === 0) return { singles, pairs };
  const mark = (item: Item, codes: readonly string[]): Item => ({ ...item, prior: priorFor(response, codes) });
  const marked = singles.map((s) => mark(s, [s.id]));
  const ordered = marked
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        STANDINGS.indexOf(a.item.standing) - STANDINGS.indexOf(b.item.standing) ||
        Number(!!a.item.prior) - Number(!!b.item.prior) ||
        a.i - b.i,
    )
    .map(({ item }) => item);
  return { singles: ordered, pairs: pairs.map((p) => mark(p, p.pair?.antibiotics ?? [])) };
}

/** The annotation on a row: "patient's ESBL finding 12.3.2025: inferred resistant". */
export function priorText(locale: Locale, prior: Prior): string {
  return t(locale, "drPatientAffects", { phenotype: phenotypeName(prior.phenotype), date: dmy(prior.date) });
}

/** One line per finding: phenotype, date, unit, organism. */
export function findingLines(locale: Locale, response: PatientFindingsResponse): string[] {
  return newestFirst(response.findings).map((f) =>
    t(locale, "drPatientFinding", {
      phenotype: phenotypeName(f.phenotype),
      date: dmy(f.date),
      unit: wardName(locale, f.ward),
      organism: shortOrganism(f.organism),
    }),
  );
}

/** The guide's carrier rule for each phenotype found, when a syndrome is chosen and the guide gives one. */
export function carrierLines(locale: Locale, syndrome: Syndrome | null | undefined, response: PatientFindingsResponse): string[] {
  if (!syndrome) return [];
  const phenotypes = [...new Set(newestFirst(response.findings).map((f) => f.phenotype))];
  return phenotypes.flatMap((ph) => {
    const rule = carrierRule(syndrome, ph);
    return rule
      ? [t(locale, "drPatientRule", { syndrome: syndrome.name[locale], phenotype: phenotypeName(ph), text: rule.text[locale] })]
      : [];
  });
}

/** The side column's Patient panel; nothing until an id has been entered. */
export function PatientPanel({ locale, state, syndrome }: { locale: Locale; state: PatientState | null; syndrome: Syndrome | null }) {
  if (!state) return null;
  const { status, response } = state;
  const lines = response ? findingLines(locale, response) : [];
  return (
    <section className="uc-block dp-panel pt" aria-labelledby="pt-title" aria-live="polite">
      <h3 id="pt-title" className="uc-title">
        <span>{t(locale, "drPatient")}</span>
        {response ? <span className="num uc-date">{dmy(response.asOf)}</span> : null}
      </h3>
      {status === "loading" && !response ? <p className="uc-sub">{t(locale, "drPatientLoading")}</p> : null}
      {status === "error" ? <p className="uc-sub">{t(locale, "drPatientError")}</p> : null}
      {response && status !== "error" ? (
        response.findings.length === 0 ? (
          <p className="uc-sub">{t(locale, "drPatientNone")}</p>
        ) : (
          <>
            <ul className="pt-findings">
              {newestFirst(response.findings).map((f, i) => (
                <li key={f.isolateId} className="num">
                  {lines[i]}
                </li>
              ))}
            </ul>
            {carrierLines(locale, syndrome, response).map((line) => (
              <p key={line} className="pt-rule">
                {line}
              </p>
            ))}
            <p className="uc-sub">{t(locale, "drPatientNote")}</p>
          </>
        )
      ) : null}
    </section>
  );
}
