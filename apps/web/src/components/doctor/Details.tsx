import type { AeiClient, CoverageResponse, NationalResponse } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import type { Syndrome } from "@aei/guideline";
import { type Locale, t } from "@aei/i18n";
import { AlertExplanation } from "../AlertExplanation.tsx";
import { AlertTri } from "../Icons.tsx";
import { certaintyOf, type DoctorFilters, halfWidth, num, pct } from "./filters.ts";
import { GuideDetails } from "./Guide.tsx";
import { NationalLines } from "./National.tsx";
import { priorText } from "./Patient.tsx";
import { flagsOf, type Item, reasonOf, STANDING } from "./reason.ts";
import { signalDate, type UnitSignal } from "./signals.ts";

interface Props {
  client: AeiClient;
  locale: Locale;
  filters: DoctorFilters;
  data: CoverageResponse;
  item: Item;
  signals: UnitSignal[];
  syndrome?: Syndrome | null;
  /** Finres national reference (D-048), fetched once per page; null when the server has none. */
  national?: NationalResponse | null;
}

/** Details on demand for the selected line: the reason, the flags, all-organism share and the last 28 days. */
export function Details({ client, locale, filters, data, item, signals, syndrome, national = null }: Props) {
  const level = certaintyOf(data.coverage.level);
  const st = STANDING[item.standing];
  const row = item.row;
  const w = halfWidth(item.interval);
  const flags = row ? flagsOf(row) : null;
  const list = (orgs: { organism: string; share: number }[]) =>
    orgs.map((o) => `${shortOrganism(o.organism as never)} ${pct(o.share)}\u00a0%`).join(", ");
  const mine = row ? signals.filter((s) => "antibiotic" in s.alert && s.alert.antibiotic === row.antibiotic) : [];
  const gain = Math.round((item.pair?.gain ?? 0) * 100);
  return (
    <div className="dt">
      <h3 className="dt-name">
        <span>{item.name}</span>
        <span className="cl-res" data-standing={item.standing}>
          <span className="cl-glyph" aria-hidden="true">
            {st.glyph}
          </span>
          {t(locale, st.long)}
        </span>
      </h3>
      <p className="dt-why">{row ? reasonOf(locale, row, data, filters) : t(locale, gain === 1 ? "drGainOne" : "drGain", { gain })}</p>
      {item.prior ? <p className="dt-prior">{priorText(locale, item.prior)}</p> : null}
      <p className="dt-fig num">
        {item.share !== null ? (
          <>
            <b>{pct(item.share)}&nbsp;%</b>
            {item.interval ? ` (${pct(item.interval[0])}–${pct(item.interval[1])})` : ""}
            {" · "}
          </>
        ) : null}
        n {num(locale, item.n)}
        {w !== null ? ` · ${t(locale, "drWidth", { w })}` : ""}
        {" · "}
        <span title={t(locale, level.label)}>
          <span aria-hidden="true">{level.glyph}</span> {t(locale, level.short)}
        </span>
      </p>
      <ul className="dt-chips">
        {row && row.basis === "spectrum" ? (
          <li className="num">
            {t(locale, "drAllOrg")}{" "}
            {row.allOrganisms.share === null
              ? "–"
              : `${pct(row.allOrganisms.share)}\u00a0%${row.allOrganisms.interval ? ` (${pct(row.allOrganisms.interval[0])}–${pct(row.allOrganisms.interval[1])})` : ""}`}{" "}
            · n {num(locale, row.coverage.counts.known)}
          </li>
        ) : null}
        {row ? (
          <li className="num" title={t(locale, "drLabelRecent")}>
            {t(locale, "drRecent", { covered: num(locale, row.coverage.recent.covered), known: num(locale, row.coverage.recent.known) })}
          </li>
        ) : null}
        {flags?.notCovering.map((o) => (
          <li key={`n${o.organism}`}>
            <span aria-hidden="true">⊘</span> {t(locale, "drNotFor", { organism: shortOrganism(o.organism), share: pct(o.share) })}
          </li>
        ))}
        {flags?.untested.map((o) => (
          <li key={`u${o.organism}`}>
            <span aria-hidden="true">?</span> {t(locale, "drUntestedOn", { organism: shortOrganism(o.organism), share: pct(o.share) })}
          </li>
        ))}
        {flags && flags.outside.length > 0 ? <li>{t(locale, "drOutside", { list: list(flags.outside) })}</li> : null}
        {mine.map((s) => (
          <li key={s.alert.id} className="dt-sig">
            <AlertTri /> {s.label} · <span className="num">{signalDate(locale, s)}</span>
          </li>
        ))}
      </ul>
      {row ? <GuideDetails locale={locale} syndrome={syndrome} code={row.antibiotic} /> : null}
      {row ? (
        <NationalLines
          locale={locale}
          national={national}
          data={data}
          antibiotic={row.antibiotic}
          specimen={filters.site}
          share={row.share}
        />
      ) : null}
      {mine.map((s) => (
        <AlertExplanation key={s.alert.id} client={client} id={s.alert.id} locale={locale} />
      ))}
    </div>
  );
}
