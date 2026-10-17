import type { CoverageResponse } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import type { Syndrome } from "@aei/guideline";
import { type Locale, specimenName, t, wardName } from "@aei/i18n";
import { BAR, barOf, certaintyOf, type DoctorFilters, dmy, num, pct, sexWord } from "./filters.ts";
import { guideCodes, guideLines } from "./Guide.tsx";
import { flagsOf, type Item, levelKey, reasonOf, STANDING } from "./reason.ts";
import { signalDate, type UnitSignal } from "./signals.ts";

interface Props {
  locale: Locale;
  filters: DoctorFilters;
  data: CoverageResponse;
  asOf: string | null;
  signals: UnitSignal[];
  singles: Item[];
  pairs: Item[];
  syndrome: Syndrome | null;
}

/** The A4 print of the list: sentences and flags written out, since the plot and the details pane do not print. Hidden on screen. */
export function PrintSheet({ locale, filters, data, asOf, signals, singles, pairs, syndrome }: Props) {
  const guided = guideCodes(syndrome);
  const guide = syndrome ? guideLines(locale, syndrome, singles, barOf(data, filters)) : null;
  const cov = data.coverage;
  const level = certaintyOf(cov.level);
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site);
  const record = [
    unit,
    site,
    filters.sex === "any" ? `${t(locale, "drSex").toLowerCase()} ${sexWord(locale, "any")}` : sexWord(locale, filters.sex),
    filters.onset ? t(locale, "drOnset") : null,
    `${t(locale, filters.sev === "mild" ? "drSevMildShort" : "drSevSevereShort")}, ${t(locale, "drBarName", { bar: barOf(data, filters) })}`,
    t(locale, filters.period === 365 ? "drPeriodYear" : "drPeriodMonth"),
    t(locale, "drPrintAsOf", { date: dmy(data.asOf) }),
  ]
    .filter(Boolean)
    .join(" · ");

  const line = (item: Item) => {
    const st = STANDING[item.standing];
    const assessable = item.standing !== "not assessable" && item.share !== null;
    const flags = item.row ? flagsOf(item.row) : null;
    return (
      <li key={item.id} className="pr-row">
        <b className="pr-name">
          {item.name}
          {item.aware ? ` (${item.aware})` : ""}
          {guided.has(item.id) ? ` [${t(locale, "drGuideMark")}]` : ""}
        </b>
        <span className="pr-num">
          {assessable && item.share !== null ? `${pct(item.share)} % ` : ""}
          {item.interval && assessable ? `(${pct(item.interval[0])}–${pct(item.interval[1])}) ` : ""}n {num(locale, item.n)}
        </span>
        <span className="pr-res">
          {st.glyph} {t(locale, st.long)}
        </span>
        <span className="pr-why">
          {item.row
            ? reasonOf(locale, item.row, data, filters)
            : `${t(locale, Math.round((item.pair?.gain ?? 0) * 100) === 1 ? "drGainOne" : "drGain", { gain: Math.round((item.pair?.gain ?? 0) * 100) })} · ${t(locale, "drAccessCount", { n: item.pair?.access ?? 0 })}`}
          {flags
            ? flags.notCovering
                .slice(0, 2)
                .map((o) => `; ${t(locale, "drNotFor", { organism: shortOrganism(o.organism), share: pct(o.share) })}`)
                .join("")
            : ""}
          {flags
            ? flags.untested
                .slice(0, 2)
                .map((o) => `; ${t(locale, "drUntestedOn", { organism: shortOrganism(o.organism), share: pct(o.share) })}`)
                .join("")
            : ""}
        </span>
      </li>
    );
  };

  return (
    <div className="pr print-only">
      <h2>
        {t(locale, "drTitle")} · {unit} · {site} · {dmy(data.asOf)}
      </h2>
      <p>
        {record}. {t(locale, "drPrintDisclaimer")}
      </p>
      <p>
        {level.glyph} {t(locale, level.label)}:{" "}
        {t(locale, cov.isolates === 1 ? "drPoolLineOne" : "drPoolLine", {
          n: num(locale, cov.isolates),
          level: t(locale, levelKey(cov.level)),
          from: dmy(cov.from),
        })}
      </p>
      {filters.sex !== "any" && !cov.sexApplied ? <p>{t(locale, "drSexDropped")}</p> : null}
      {filters.onset && !cov.onsetApplied ? <p>{t(locale, "drOnsetDropped", { bar: barOf(data, filters) })}</p> : null}
      {syndrome && guide ? (
        <p>
          {syndrome.name[locale]}: {[...guide.lines, ...(guide.also ? [guide.also] : [])].join("; ")}.
        </p>
      ) : null}
      {signals.slice(0, 2).map((s) => (
        <p key={s.alert.id}>
          {s.feeder
            ? t(locale, "drSignalFeeder", { unit: wardName(locale, s.feeder), label: s.label, date: signalDate(locale, s) })
            : t(locale, "drSignalHere", { label: s.label, date: signalDate(locale, s) })}
        </p>
      ))}
      <ul className="pr-rows">
        {singles.map(line)}
        {pairs.length > 0 ? <li className="pr-div">{t(locale, "drTwoTogether")}</li> : null}
        {pairs.map(line)}
      </ul>
      <p className="pr-foot">
        {t(locale, "drFoot", { mild: BAR.mild, severe: BAR.severe })} {t(locale, "drFootOnset", { bar: BAR.severe })}
      </p>
      {asOf ? <p className="pr-foot">{t(locale, "drPrinted", { date: dmy(asOf) })}</p> : null}
    </div>
  );
}
