import type { IsoDate } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { addDaysIso, formatNum, formatPSup } from "./mathHelpers.ts";
import "./WeeklyWindow.css";

export interface WeeklyWindowProps {
  /** Distinct patients per week (see `weeklyPatients`). */
  weeks: { start: IsoDate; count: number }[];
  /** First day of the detector's window; weeks starting on or after it are drawn dark. */
  windowStart: IsoDate;
  observed: number;
  /** Expected patients over the whole window. */
  expected: number;
  p: number;
  alertDate: IsoDate;
  locale: Locale;
}

const W = 320;
const H = 140;
const L = 26;
const R = 8;
const T = 16;
const B = 34;
const DAY = 86_400_000;
const ms = (d: IsoDate) => Date.parse(`${d}T00:00:00Z`);

/** Weekly patients with the phenotype in the unit: baseline weeks grey, window weeks dark, the usual level dashed, the first signal as a triangle (experiments/0015 figure style). */
export function WeeklyWindow({ weeks, windowStart, observed, expected, p, alertDate, locale }: WeeklyWindowProps) {
  if (weeks.length === 0) return <p className="ww-note">{t(locale, "mathNoData")}</p>;
  const t0 = ms((weeks[0] as { start: IsoDate }).start);
  const t1 = ms(addDaysIso((weeks.at(-1) as { start: IsoDate }).start, 7));
  const span = Math.max(1, t1 - t0);
  const px = (d: number) => L + ((d - t0) / span) * (W - L - R);
  const bw = ((W - L - R) * 7 * DAY) / span;
  const maxC = Math.max(...weeks.map((w) => w.count), expected, 1);
  const top = Math.max(2, Math.ceil(maxC));
  const py = (v: number) => T + (H - T - B) * (1 - v / top);
  const base = py(0);
  const nWin = Math.max(1, weeks.filter((w) => w.start >= windowStart).length);
  const perWeek = expected / nWin;
  const winX = px(ms(windowStart));
  const ax = px(Math.min(Math.max(ms(alertDate), t0), t1));
  const ps = formatPSup(p, locale);
  const exp = formatNum(expected, locale);
  const caption = t(locale, "mathWeekCaption", { observed, expected: exp, p: ps });
  const aria = t(locale, "mathWeekAria", { n: weeks.length, w: nWin, observed, expected: exp, p: ps, date: alertDate });
  const yTicks = top <= 6 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, Math.round(top / 2), top];
  const perLabel = Math.max(1, Math.ceil(52 / bw));
  const months = weeks.filter((w, i) => i === 0 || w.start.slice(0, 7) !== (weeks[i - 1] as { start: string }).start.slice(0, 7));
  const monthStep = Math.max(1, Math.ceil(perLabel / Math.max(1, weeks.length / months.length)));
  return (
    <figure className="math-weekly">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="ww-svg">
        {yTicks.map((v) => (
          <g key={v}>
            <line className="ww-grid" x1={L} x2={W - R} y1={py(v)} y2={py(v)} />
            <text className="ww-tick" x={L - 4} y={py(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {weeks.map((w) => {
          const inWin = w.start >= windowStart;
          const x = px(ms(w.start));
          return (
            <rect
              key={w.start}
              className={inWin ? "ww-bar ww-bar-win" : "ww-bar"}
              x={x + bw * 0.1}
              width={Math.max(1, bw * 0.8)}
              y={py(w.count)}
              height={Math.max(0, base - py(w.count))}
            />
          );
        })}
        <line className="ww-win" x1={winX} x2={winX} y1={T} y2={base} />
        <text
          className="ww-tick ww-win-label"
          x={winX > W * 0.6 ? winX - 3 : winX + 3}
          y={T - 3}
          textAnchor={winX > W * 0.6 ? "end" : "start"}
        >
          {t(locale, "mathWeekWindow")}
        </text>
        <line className="ww-usual" x1={winX} x2={W - R} y1={py(perWeek)} y2={py(perWeek)} />
        <path className="ww-sig" d={`M${ax - 5} ${base + 9}L${ax + 5} ${base + 9}L${ax} ${base + 1}Z`} />
        {months
          .filter((_, i) => i % monthStep === 0)
          .map((w) => (
            <text key={w.start} className="ww-tick" x={px(ms(w.start))} y={H - 16} textAnchor="start">
              {w.start.slice(0, 7)}
            </text>
          ))}
        <text className="ww-tick ww-sig-label" x={Math.min(ax, W - R)} y={H - 3} textAnchor={ax > W * 0.6 ? "end" : "start"}>
          ▲ {t(locale, "mathWeekFirstSignal", { date: alertDate })}
        </text>
      </svg>
      <figcaption className="ww-cap">
        <span className="ww-formula">{caption}</span>
        <span className="ww-legend">
          <i className="ww-sw" aria-hidden="true" /> {t(locale, "mathWeekBaseline")} <i className="ww-sw ww-sw-win" aria-hidden="true" />{" "}
          {t(locale, "mathWeekWindow")} · {t(locale, "mathWeekAxis")}
        </span>
      </figcaption>
    </figure>
  );
}
