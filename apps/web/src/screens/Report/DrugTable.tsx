import type { DrugRow, ReportTable } from "@aei/empiric";
import type { ReactNode } from "react";
import { cellValue } from "../../analytics/helpers.ts";
import { formatDate, formatNumber, formatShare, type Locale, t } from "../../i18n/index.ts";
import { AwareBadge, Card, EmptyState, Icon, Segmented } from "../../ui/index.ts";
import { largestDrop, MIN, RECENT_DAYS, SORT_KEYS, type SortKey, sortRows, windowStart, YEAR_DAYS } from "./model.ts";
import { Change, cap, Fig, MonthSpark } from "./parts.tsx";

/*
  The antibiotics view: one row per treatment antibiotic for the chosen
  infection site, the last 4 weeks next to 12 months (and every unit's 12
  months when one unit is chosen), a 12-month sparkline and the change.
  A table from 880 px; stacked rows below it (no page-level sideways scroll).
*/

export function DrugTable({
  locale,
  model,
  wide,
  sort,
  onSort,
  drugName,
  actions,
  treatLink,
  thinActions,
}: {
  locale: Locale;
  model: ReportTable;
  /** Room for a real table. */
  wide: boolean;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  drugName: (code: string) => string;
  /** Card actions (the CSV button). */
  actions: ReactNode;
  /** "Open in Treat" for the chosen unit, when there is one. */
  treatLink: ReactNode;
  /** Buttons that widen the group, shown when 12 months is too thin. */
  thinActions: ReactNode;
}) {
  const num = (v: number) => formatNumber(locale, v);
  const rows = sortRows(model.rows, sort);
  const hasHospital = model.hospitalN !== null;
  const recentFrom = formatDate(locale, windowStart(model.asOf, RECENT_DAYS));
  const yearFrom = formatDate(locale, windowStart(model.asOf, YEAR_DAYS), "long");
  const to = formatDate(locale, model.asOf, "long");
  const organismKnown = !!model.query.organism;

  const drop = largestDrop(model.rows);
  const comparable = model.rows.some((r) => r.change !== null);
  let standout: ReactNode = null;
  if (drop && drop.recent.share && drop.year.share) {
    standout = (
      <p className="report-note is-standout">
        <Icon name="trend-down" size={18} />
        <span>
          {t(locale, "report.standout.drop", {
            drug: cap(locale, drugName(drop.code)),
            recent: formatShare(locale, cellValue(drop.recent) ?? 0),
            rn: num(drop.recent.share.n),
            year: formatShare(locale, cellValue(drop.year) ?? 0),
            yn: num(drop.year.share.n),
          })}
        </span>
      </p>
    );
  } else if (comparable) {
    standout = (
      <p className="report-note">
        <Icon name="check" size={18} />
        <span>{t(locale, "report.standout.none")}</span>
      </p>
    );
  }

  const thinYear = model.yearN > 0 && model.yearN < MIN;
  const thinRecent = !thinYear && model.yearN > 0 && model.recentN < MIN;

  const body =
    model.yearN === 0 || model.rows.length === 0 ? (
      <EmptyState compact icon="inbox" title={t(locale, "report.empty.title")} body={t(locale, "report.empty.body")} action={thinActions} />
    ) : wide ? (
      <Table locale={locale} rows={rows} model={model} hasHospital={hasHospital} drugName={drugName} />
    ) : (
      <List locale={locale} rows={rows} hasHospital={hasHospital} drugName={drugName} />
    );

  return (
    <Card className="report-card" title={t(locale, "report.table.title")} actions={actions}>
      <div className="report-basis">
        <p className="report-basis-counts u-num">
          {t(locale, "report.basis.counts", { year: num(model.yearN), recent: num(model.recentN) })}
        </p>
        {hasHospital && model.hospitalN !== null ? (
          <p className="report-basis-more u-num">{t(locale, "report.basis.hospital", { n: num(model.hospitalN) })}</p>
        ) : null}
        <p className="report-basis-more u-num">{t(locale, "report.basis.periods", { recentFrom, yearFrom, to })}</p>
        {treatLink}
      </div>

      {thinYear ? (
        <div className="report-note is-thin" role="note">
          <Icon name="info" size={18} />
          <div className="u-stack-sm">
            <span>{t(locale, "report.thin.year", { min: num(MIN) })}</span>
            {thinActions ? <div className="u-row">{thinActions}</div> : null}
          </div>
        </div>
      ) : null}
      {thinRecent ? (
        <p className="report-note is-thin">
          <Icon name="info" size={18} />
          <span>{t(locale, "report.thin.recent", { n: num(model.recentN) })}</span>
        </p>
      ) : null}
      {standout}

      {model.rows.length > 1 ? (
        <div className="report-toolbar">
          <Segmented
            label={t(locale, "report.sort.label")}
            value={sort}
            options={SORT_KEYS.map((k) => ({ value: k, label: t(locale, `report.sort.${k}`) }))}
            onChange={onSort}
            size="sm"
            stretch={!wide}
            showLabel
          />
        </div>
      ) : null}

      {body}

      {model.hidden.length > 0 && model.yearN > 0 ? (
        <p className="report-hidden">
          {t(locale, organismKnown ? "report.hidden.known" : "report.hidden.unknown", {
            list: model.hidden.map((c) => drugName(c)).join(", "),
          })}
        </p>
      ) : null}
    </Card>
  );
}

function DrugName({ locale, row, drugName }: { locale: Locale; row: DrugRow; drugName: (code: string) => string }) {
  return (
    <span className="report-drug">
      <span className="report-drug-name">{cap(locale, drugName(row.code))}</span>
      <AwareBadge locale={locale} group={row.aware} />
    </span>
  );
}

function Table({
  locale,
  rows,
  model,
  hasHospital,
  drugName,
}: {
  locale: Locale;
  rows: readonly DrugRow[];
  model: ReportTable;
  hasHospital: boolean;
  drugName: (code: string) => string;
}) {
  const isolates = (n: number) => t(locale, "report.col.isolates", { n: formatNumber(locale, n) });
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <caption className="u-sr">{t(locale, "report.table.caption")}</caption>
        <thead>
          <tr>
            <th scope="col" className="is-drug">
              {t(locale, "report.col.antibiotic")}
            </th>
            <th scope="col" className="is-fig">
              <span className="report-th">{t(locale, "report.col.recent")}</span>
              <span className="report-th-sub u-num">{isolates(model.recentN)}</span>
            </th>
            <th scope="col" className="is-fig">
              <span className="report-th">{t(locale, "report.col.year")}</span>
              <span className="report-th-sub u-num">{isolates(model.yearN)}</span>
            </th>
            {hasHospital ? (
              <th scope="col" className="is-fig">
                <span className="report-th">{t(locale, "report.col.hospital")}</span>
                <span className="report-th-sub u-num">{isolates(model.hospitalN ?? 0)}</span>
              </th>
            ) : null}
            <th scope="col" className="is-spark">
              <span className="report-th">{t(locale, "report.col.months")}</span>
            </th>
            <th scope="col" className="is-change">
              <span className="report-th">{t(locale, "report.col.change")}</span>
              <span className="report-th-sub">{t(locale, "report.col.changeHint")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <th scope="row" className="is-drug">
                <DrugName locale={locale} row={row} drugName={drugName} />
              </th>
              <td className="is-fig">
                <Fig locale={locale} cell={row.recent} />
              </td>
              <td className="is-fig">
                <Fig locale={locale} cell={row.year} />
              </td>
              {hasHospital && row.hospital ? (
                <td className="is-fig is-ref">
                  <Fig locale={locale} cell={row.hospital} />
                </td>
              ) : null}
              <td className="is-spark">
                <MonthSpark locale={locale} drug={cap(locale, drugName(row.code))} months={row.months} />
              </td>
              <td className="is-change">
                <Change locale={locale} change={row.change} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function List({
  locale,
  rows,
  hasHospital,
  drugName,
}: {
  locale: Locale;
  rows: readonly DrugRow[];
  hasHospital: boolean;
  drugName: (code: string) => string;
}) {
  return (
    <ul className="report-list">
      {rows.map((row) => (
        <li key={row.code} className="report-item">
          <h3 className="report-item-title">
            <DrugName locale={locale} row={row} drugName={drugName} />
          </h3>
          <dl className={`report-item-figs${hasHospital ? " has-3" : ""}`}>
            <div>
              <dt>{t(locale, "report.col.recent")}</dt>
              <dd>
                <Fig locale={locale} cell={row.recent} />
              </dd>
            </div>
            <div>
              <dt>{t(locale, "report.col.year")}</dt>
              <dd>
                <Fig locale={locale} cell={row.year} />
              </dd>
            </div>
            {hasHospital && row.hospital ? (
              <div className="is-ref">
                <dt>{t(locale, "report.col.hospitalShort")}</dt>
                <dd>
                  <Fig locale={locale} cell={row.hospital} />
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="report-item-trend">
            <div className="report-item-spark">
              <span className="report-item-label">{t(locale, "report.col.months")}</span>
              <MonthSpark locale={locale} drug={cap(locale, drugName(row.code))} months={row.months} fluid />
            </div>
            <div className="report-item-change">
              <span className="report-item-label">{t(locale, "report.col.changeHint")}</span>
              <Change locale={locale} change={row.change} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
