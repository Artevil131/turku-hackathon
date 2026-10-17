import type { AntibioticCode } from "@aei/domain";
import { antibioticName, type Locale, type MessageKey, t } from "@aei/i18n";
import "./FailsTogether.css";
import { num, pct } from "./filters.ts";

// "Fails together" (D-054): when the selected antibiotic failed on an isolate,
// which other drugs failed on the same isolate, from the hospital's own data.
// The shape matches FailsTogetherResponse in @aei/coresistance/route; once the
// route is wired, take the type from @aei/contract instead of these.

type Level = "unit" | "ward type" | "hospital";

export interface FailsTogetherLink {
  antibiotic: AntibioticCode;
  partner: AntibioticCode;
  resisted: number;
  resistedBoth: number;
  share: number;
  interval: [number, number];
  level: Level;
  filters: string[];
}

export interface FailsTogetherData {
  failsTogether: {
    query: { minResisted: number; sex: string | null; ageGroup: string | null; onset: string | null };
    byAntibiotic: { antibiotic: AntibioticCode; linked: FailsTogetherLink[] }[];
  };
  families: { class: string; antibiotics: AntibioticCode[] }[];
}

interface Props {
  locale: Locale;
  antibiotic: AntibioticCode;
  data: FailsTogetherData | null;
  loading?: boolean;
}

const WHERE: Record<Level, MessageKey> = { unit: "ftWhereUnit", "ward type": "ftWhereWardType", hospital: "ftWhereHospital" };
const LEVEL: Record<Level, MessageKey> = { unit: "ftLevelUnit", "ward type": "ftLevelWardType", hospital: "ftLevelHospital" };

/** One calm line per linked drug, most linked first, with the level each count comes from. */
export function FailsTogether({ locale, antibiotic, data, loading = false }: Props) {
  const a = antibioticName(locale, antibiotic);
  if (!data) {
    return loading ? (
      <section className="ft" aria-busy="true">
        <p className="ft-empty">{t(locale, "ftLoading")}</p>
      </section>
    ) : null;
  }
  const { query, byAntibiotic } = data.failsTogether;
  const floor = query.minResisted;
  const asked = [query.sex, query.ageGroup, query.onset].filter(Boolean).length;
  const links = byAntibiotic.find((x) => x.antibiotic === antibiotic)?.linked ?? [];
  const family = data.families.find((f) => f.antibiotics.includes(antibiotic));
  return (
    <section className="ft" aria-labelledby={`ft-${antibiotic}`}>
      <h4 className="ft-title" id={`ft-${antibiotic}`} title={t(locale, "ftInfo", { floor })}>
        {t(locale, "ftTitle")}
      </h4>
      {links.length === 0 ? (
        <p className="ft-empty">{t(locale, "ftNone", { a, floor })}</p>
      ) : (
        <ul className="ft-list">
          {links.map((l) => {
            const same = family?.antibiotics.includes(l.partner) ?? false;
            return (
              <li key={l.partner} className="ft-line" data-level={l.level}>
                <span className="ft-text">
                  {t(locale, "ftLine", {
                    a,
                    b: antibioticName(locale, l.partner),
                    where: t(locale, WHERE[l.level]),
                    share: pct(l.share),
                    both: num(locale, l.resistedBoth),
                    n: num(locale, l.resisted),
                  })}
                </span>
                <span className="ft-meta num">
                  <span title={t(locale, "ftInterval", { lo: pct(l.interval[0]), hi: pct(l.interval[1]) })}>
                    {pct(l.interval[0])}–{pct(l.interval[1])} %
                  </span>
                  {" · "}
                  {t(locale, LEVEL[l.level])}
                  {same ? <span className="ft-class">{t(locale, "ftSameClass")}</span> : null}
                  {l.filters.length < asked ? <span className="ft-dropped"> · {t(locale, "ftFilterDropped", { floor })}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
