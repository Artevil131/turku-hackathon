import { formatDateNumeric, type Locale, t, wardName } from "@aei/i18n";
import { unitLabel } from "./names.ts";
import type { Spans } from "./spans.ts";

// The units an incident spans as compact chips: "URO → ED 34 % · MED-A 12 %".
// Words and arrows carry the meaning; colour only separates the origin.

const pct = (share: number) => `${Math.round(share * 100)} %`;

export function SpanLine({ locale, spans, ward }: { locale: Locale; spans: Spans | null; ward: string | null }) {
  const origin = ward ? (
    <b className="sp-origin" title={wardName(locale, ward as never)}>
      {ward}
    </b>
  ) : (
    <span className="sp-origin sp-wide">{unitLabel(locale, null)}</span>
  );
  if (!spans || !ward) return <span className="sp-line">{origin}</span>;
  return (
    <span className="sp-line">
      {origin}
      {spans.next.length > 0 ? (
        <>
          <span className="sp-arrow" aria-hidden="true">
            →
          </span>
          <span className="visually-hidden">{t(locale, "feedSpanNext")}</span>
          {spans.next.slice(0, 2).map((n) => (
            <span
              key={n.unit}
              className="sp-chip"
              title={t(locale, "feedSpanPatients", {
                n: n.patients,
                unit: ward,
                from: spans.from ? formatDateNumeric(spans.from) : "",
                to: spans.to ? formatDateNumeric(spans.to) : "",
              })}
            >
              {n.unit} {pct(n.share)}
            </span>
          ))}
        </>
      ) : null}
      {spans.trail.map((x) => (
        <span
          key={`t${x.unit}${x.direction}`}
          className="sp-chip sp-trail"
          title={t(locale, "feedSpanTrailTitle", {
            n: x.patients,
            confirmed: x.confirmed,
            from: spans.from ? formatDateNumeric(spans.from) : "",
            to: spans.to ? formatDateNumeric(spans.to) : "",
          })}
        >
          <span className="sp-tag">{t(locale, "feedSpanTrail")}</span> {x.direction === "out" ? "→" : "←"}
          {x.unit}
        </span>
      ))}
      {spans.also.slice(0, 2).map((x) => (
        <span
          key={x.incident}
          className="sp-chip sp-also"
          title={`${t(locale, "feedSpanSame")} ${wardName(locale, x.unit)} ${formatDateNumeric(x.date)}`}
        >
          <span className="sp-tag">{t(locale, "feedSpanSame")}</span> {x.unit}
        </span>
      ))}
    </span>
  );
}

/** Full chips for the math panel: one group per relation, each chip with its count. */
export function SpanGroups({ locale, spans, onUnit }: { locale: Locale; spans: Spans; onUnit: (unit: string) => void }) {
  const win = spans.from && spans.to ? `${formatDateNumeric(spans.from)}–${formatDateNumeric(spans.to)}` : "";
  const unit = (code: string, text: string, title: string) => (
    <button key={`${code}${text}`} type="button" className="sp-chip sp-btn" title={title} onClick={() => onUnit(code)}>
      {text}
    </button>
  );
  return (
    <div className="sp-groups">
      <div className="sp-group">
        <span className="sp-items">
          {spans.origin ? (
            <button
              type="button"
              className="sp-chip sp-btn sp-origin"
              title={wardName(locale, spans.origin)}
              onClick={() => onUnit(spans.origin as string)}
            >
              {spans.origin}
            </button>
          ) : (
            <span className="sp-chip sp-origin">{unitLabel(locale, null)}</span>
          )}
        </span>
      </div>
      {spans.next.length > 0 ? (
        <div className="sp-group">
          <span className="sp-glabel">
            {t(locale, "feedSpanNext")} <span className="sp-win">{win}</span>
          </span>
          <span className="sp-items">
            {spans.next.map((n) => unit(n.unit, `${n.unit} ${pct(n.share)} · n ${n.patients}`, wardName(locale, n.unit)))}
          </span>
        </div>
      ) : null}
      {spans.trail.length > 0 ? (
        <div className="sp-group">
          <span className="sp-glabel">{t(locale, "feedSpanTrail")}</span>
          <span className="sp-items">
            {spans.trail.map((x) =>
              unit(
                x.unit,
                `${x.direction === "out" ? "→" : "←"} ${x.unit} · n ${x.patients}`,
                t(locale, "feedSpanTrailTitle", { n: x.patients, confirmed: x.confirmed, from: spans.from ?? "", to: spans.to ?? "" }),
              ),
            )}
          </span>
        </div>
      ) : null}
      {spans.also.length > 0 ? (
        <div className="sp-group">
          <span className="sp-glabel">{t(locale, "feedSpanSame")}</span>
          <span className="sp-items">
            {spans.also.map((x) => unit(x.unit, `${x.unit} · ${formatDateNumeric(x.date)}`, wardName(locale, x.unit)))}
          </span>
        </div>
      ) : null}
      {spans.next.length + spans.trail.length + spans.also.length === 0 ? <p className="sp-none">{t(locale, "feedNoSpan")}</p> : null}
    </div>
  );
}
