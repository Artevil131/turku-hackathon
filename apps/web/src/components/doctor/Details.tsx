import type { AeiClient, CoverageResponse, NationalResponse } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import type { Syndrome } from "@aei/guideline";
import { type Locale, t } from "@aei/i18n";
import { AlertExplanation } from "../AlertExplanation.tsx";
import { AlertTri } from "../Icons.tsx";
import { span } from "./CoverageList.tsx";
import { barOf, type DoctorFilters, num, pct } from "./filters.ts";
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

/**
 * Details on demand for the selected line: one sentence with the share, its interval and the verdict, the data it
 * rests on, then a three-line table of both bases and the last four weeks, and the flags.
 */
export function Details({ client, locale, filters, data, item, signals, syndrome, national = null }: Props) {
  const st = STANDING[item.standing];
  const row = item.row;
  const flags = row ? flagsOf(row) : null;
  const list = (orgs: { organism: string; share: number }[]) =>
    orgs.map((o) => `${shortOrganism(o.organism as never)} ${pct(o.share)}\u00a0%`).join(", ");
  const mine = row ? signals.filter((s) => "antibiotic" in s.alert && s.alert.antibiotic === row.antibiotic) : [];
  const share = (s: { share: number | null; interval: [number, number] | null }) =>
    s.share === null ? "–" : `${pct(s.share)}\u00a0%${s.interval ? ` (${pct(s.interval[0])}–${pct(s.interval[1])})` : ""}`;
  const gain = Math.round((item.pair?.gain ?? 0) * 100);
  const period = span(locale, filters.period);
  const bar = barOf(data, filters);
  // The sentence: the share and its interval in words, then what that means against the bar, then the data it rests on.
  const figure =
    item.share === null
      ? null
      : item.interval
        ? t(locale, "drDetailShare", {
            share: pct(item.share),
            n: num(locale, item.n),
            period,
            lo: pct(item.interval[0]),
            hi: pct(item.interval[1]),
          })
        : t(locale, "drDetailShareNoInterval", { share: pct(item.share), n: num(locale, item.n), period });
  const verdict = !row
    ? t(locale, gain === 1 ? "drGainOne" : "drGain", { gain })
    : item.standing === "clears"
      ? t(locale, "drDetailClears", { bar })
      : item.standing === "borderline"
        ? t(locale, "drDetailBorderline", { bar })
        : item.standing === "below"
          ? t(locale, "drDetailBelow", { bar })
          : reasonOf(locale, row, data, filters);
  const recent = row?.coverage.recent;
  /** The data the figure rests on, in full words ("own unit data", "similar units' data (unit had too few)"). */
  const basis = { unit: "drLevelUnit", "ward type": "drLevelWardType", hospital: "drLevelHospital" } as const;
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
      <p className="dt-why">
        {figure ? `${figure} ` : ""}
        {verdict} {t(locale, "drDetailBasedOn", { level: t(locale, basis[data.coverage.level]) })}
      </p>
      {item.prior ? <p className="dt-prior">{priorText(locale, item.prior)}</p> : null}
      {row ? (
        <table className="dt-table num">
          <tbody>
            <tr>
              <th scope="row">{t(locale, "drDetailWithin", { period })}</th>
              <td>
                {share(row.coverage.spectrum)} · n {num(locale, row.coverage.spectrum.counts.known)}
              </td>
            </tr>
            <tr>
              <th scope="row">{t(locale, "drDetailAll", { period })}</th>
              <td>
                {share(row.coverage)} · n {num(locale, row.coverage.counts.known)}
              </td>
            </tr>
            <tr>
              <th scope="row">{t(locale, "drDetailAll4wk")}</th>
              <td>{recent ? `${num(locale, recent.covered)} / ${num(locale, recent.known)}` : "—"}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
      <ul className="dt-chips">
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
