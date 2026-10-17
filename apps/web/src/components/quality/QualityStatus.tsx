import type { CheckSummary } from "@aei/contract";
import { type Locale, type MessageKey, t } from "@aei/i18n";
import { useEffect, useId, useRef, useState } from "react";
import { compactDate } from "../hero/geometry.ts";
import { AlertTri, Check, Cross } from "../Icons.tsx";
import "./quality.css";
import type { QualityState } from "./useQuality.ts";

const grouped = (locale: Locale, n: number) => n.toLocaleString(locale === "fi" ? "fi-FI" : "en-GB").replace(/[,  ]/g, " ");

const total = (summary: CheckSummary[]) => summary.reduce((s, c) => s + c.count, 0);

/**
 * A quiet status for the plausibility checks (D-038): a glyph and a few words, and a popover that
 * lists each check by name with its count. Severity is a glyph and a word, never colour alone.
 */
export function QualityStatus({ locale, state }: { locale: Locale; state: QualityState }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (state.kind === "loading") {
    return (
      <span className="q-status q-quiet" role="status">
        {t(locale, "qLoading")}
      </span>
    );
  }
  if (state.kind !== "ready") {
    return (
      <span className="q-status q-quiet" role="status">
        {t(locale, "qUnavailable")}
      </span>
    );
  }

  const { data, asOf } = state;
  const n = total(data.summary);
  const clean = n === 0;
  const label = clean ? t(locale, "qPassed") : n === 1 ? t(locale, "qFindingsOne") : t(locale, "qFindings", { n: grouped(locale, n) });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc closes the popover from anywhere inside it
    <span
      className="q-status"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={button}
        className="q-btn"
        data-clean={clean || undefined}
        aria-expanded={open}
        aria-controls={id}
        title={t(locale, "qOpen")}
        onClick={() => setOpen((o) => !o)}
      >
        {clean ? <Check width={14} height={14} /> : <AlertTri width={14} height={14} />}
        <span className="q-label">{label}</span>
      </button>
      {open ? (
        <div className="q-pop" id={id} role="note">
          <b className="q-title">{t(locale, "qTitle")}</b>
          {clean ? (
            <p className="q-none">
              <Check width={14} height={14} /> {t(locale, "qNone")}
            </p>
          ) : (
            <ul className="q-list">
              {data.summary.map((c) => (
                <li key={c.check}>
                  <span className="q-sev" data-sev={c.severity} title={t(locale, c.severity === "error" ? "qErrorHint" : "qSuspectHint")}>
                    {c.severity === "error" ? <Cross width={12} height={12} /> : <AlertTri width={12} height={12} />}
                    {t(locale, c.severity === "error" ? "qError" : "qSuspect")}
                  </span>
                  <span className="q-name">{t(locale, `qc-${c.check}` as MessageKey)}</span>
                  <span className="q-count num">{grouped(locale, c.count)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="q-meta">
            {t(locale, "qChecked", {
              patients: grouped(locale, data.checked.patients),
              cultures: grouped(locale, data.checked.cultures),
              isolates: grouped(locale, data.checked.isolates),
              results: grouped(locale, data.checked.results),
            })}
          </p>
          <p className="q-meta">
            {t(locale, "qAsOf", { date: compactDate(asOf) })} · {t(locale, "qNote")}
          </p>
        </div>
      ) : null}
    </span>
  );
}
