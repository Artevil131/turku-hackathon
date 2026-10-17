import type { CoverageResponse } from "@aei/contract";
import { shortOrganism } from "@aei/domain";
import { type Locale, specimenName, t, wardName } from "@aei/i18n";
import { AGE_KEYS, BAR, certaintyOf, type DoctorFilters, dmy, num, pct, sexWord } from "./filters.ts";
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
}

/** The A4 print of the list: sentences and flags written out, since the plot and the details pane do not print. Hidden on screen. */
export function PrintSheet({ locale, filters, data, asOf, signals, singles, pairs }: Props) {
  const cov = data.coverage;
  const level = certaintyOf(cov.level);
  const unit = wardName(locale, filters.unit);
  const site = specimenName(locale, filters.site);
  const ageChosen = filters.age !== "any";
  const record = [
    unit,
    site,
    filters.sex === "any" ? `${t(locale, "drSex").toLowerCase()} ${sexWord(locale, "any")}` : sexWord(locale, filters.sex),
    ageChosen ? `${t(locale, "drPrintAge", { age: t(locale, AGE_KEYS[filters.age]) })} (${t(locale, "drNotApplied")})` : null,
    filters.onset ? `${t(locale, "drOnset")} (${t(locale, "drNotApplied")})` : null,
    t(locale, filters.sev === "mild" ? "drSevMild" : "drSevSevere"),
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
        </b>
        <span className="pr-num">
          {assessable && item.share !== null ? `${pct(item.share)}\u00a0% ` : ""}
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
      {ageChosen || filters.onset ? (
        <p>{t(locale, ageChosen && filters.onset ? "drNotAppliedBoth" : ageChosen ? "drNotAppliedAge" : "drNotAppliedDay3")}</p>
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
      <p className="pr-foot">{t(locale, "drFoot", { mild: BAR.mild, severe: BAR.severe })}</p>
      {asOf ? <p className="pr-foot">{t(locale, "drPrinted", { date: dmy(asOf) })}</p> : null}
    </div>
  );
}
