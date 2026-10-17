# @aei/guideline

The hospital's empirical-treatment guide as data (D-047): per syndrome the
specimen, severity, onset and sex it applies to, the first choices (drug,
dose and route as the guide words them), the beta-lactam-allergy
alternative, the rules for known ESBL, MRSA, CPE and VRE carriers, the
treatment duration, and the section and page it comes from.

    guide(site = "varha")                              // the site's Guide; throws for a site without one
    syndromesFor(specimen, severity?, onset?, sex?)    // matching syndromes, most specific first
    firstChoiceCodes(syndrome)                         // first-choice drugs among the dataset's 13 codes
    carrierRule(syndrome, phenotype)                   // the guide's carrier rule, or undefined
    syndromeDefaults(syndrome)                         // { specimen, severity, onset, sex } for the record strip

Source for the demo site: Varha's **Mikrobilääkesuositus**, dated
13.4.2026, <https://hoito-ohjeet.fi/fi/Ohjepankki/YHTEINEN/Mikrobil%C3%A4%C3%A4kesuositus.pdf>
(summary in research/guidelines.md section 1). Encoded: urinary infections
(7.4.1 A, D, E, F), sepsis of unknown focus, community and
healthcare-associated (6.2.1, the guide numbers both so), urinary-source
sepsis (6.3.1) and chronic wound infection by tier (7.1.4). Pages are the
guide's printed page numbers, which equal the PDF pages.

Each `Choice` carries a dataset code (`@aei/domain` `AntibioticCode`) only
when the guide's drug is one of the thirteen (pivmecillinam → MEC,
fluoroquinolone → CIP and so on); ertapenem, cloxacillin, flucloxacillin,
cefalexin, fosfomycin and sulfamethoxazole-trimethoprim stay text with
`drug: null`. Finnish text quotes the guide; English translates it plainly.
Doses live in the text only and are never computed with.

This is configuration per site, not analysis. A site adds its own guide as
another `Guide` constant. The guide marks its first choice on the coverage
list; it never adds a drug to the list or changes the list's order (D-026,
D-027, D-047).

Relies on: D-004, D-047. Tests: `src/guideline.test.ts`.
