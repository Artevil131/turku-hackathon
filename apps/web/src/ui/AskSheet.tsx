import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type AgeGroup, AiError, type AiErrorCode, askAi, type ResolvedPeriod } from "../ai/index.ts";
import type { FeedMeta, IsoDate } from "../feed/types.ts";
import { formatDate, type Locale, named, t } from "../i18n/index.ts";
import type { AgeBand, Onset } from "../model/types.ts";
import type { ReportPrefs } from "../screens/Report/index.tsx";
import type { TreatPrefs } from "../screens/Treat/index.tsx";
import { RemovableChip } from "./Chips.tsx";
import { ageLabel, defaultSpecimen, defaultWard, onsetLabel, sexLabel, specimenName, unitName } from "./defaults.ts";
import { Icon } from "./Icon.tsx";
import { Org, shortOrganism } from "./Org.tsx";
import { Picker } from "./Picker.tsx";
import { Sheet } from "./Sheet.tsx";

/*
  AskSheet: the optional AI overlay. Shown only when the language model is
  available. A question in the doctor's own words becomes filters (chips the
  doctor can change or remove); the model never produces a number.
    open, onClose
    locale       Locale
    meta         FeedMeta          every choice offered comes from its code lists
    asOf         IsoDate           the period ("last 3 months") is resolved against it
    sexes        string[]          sex codes present in the released results
    onShowTreat  (patch: Partial<TreatPrefs>) => void   "Show what works"
    onOpenReport (patch: Partial<ReportPrefs>) => void  "Open in report"
*/

interface Chosen {
  ward?: string;
  specimen?: string;
  organism?: string;
  sex?: string;
  age?: AgeBand;
  onset?: Onset;
  period?: ResolvedPeriod;
}

type Phase =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "answer"; chosen: Chosen; unmatched: string[]; intent?: string }
  | { kind: "error"; code: AiErrorCode };

const toBand = (g: AgeGroup | undefined): AgeBand | undefined =>
  g === undefined ? undefined : g === "older" || g === "very_old" ? "65plus" : "under65";

export function AskSheet({
  open,
  onClose,
  locale,
  meta,
  asOf,
  sexes,
  onShowTreat,
  onOpenReport,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  meta: FeedMeta;
  asOf: IsoDate;
  sexes: readonly string[];
  onShowTreat: (patch: Partial<TreatPrefs>) => void;
  onOpenReport: (patch: Partial<ReportPrefs>) => void;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abort.current?.abort();
      abort.current = null;
      setPhase((p) => (p.kind === "thinking" ? { kind: "idle" } : p));
    }
  }, [open]);
  useEffect(() => () => abort.current?.abort(), []);

  // Examples and the placeholder are built from the feed's own lists.
  const examples = useMemo(() => {
    const specimen = specimenName(locale, meta, defaultSpecimen(meta));
    const unit = unitName(locale, meta, defaultWard(meta));
    const organism = meta.organisms[0] ? shortOrganism(meta.organisms[0]) : "";
    const list = [t(locale, "common.ask.exUnit", { specimen, unit }), t(locale, "common.ask.exGroup", { specimen })];
    if (organism) list.splice(1, 0, t(locale, "common.ask.exOrganism", { organism }));
    return list;
  }, [locale, meta]);
  const placeholder = useMemo(
    () =>
      t(locale, "common.ask.placeholder", {
        specimen: specimenName(locale, meta, defaultSpecimen(meta)),
        organism: meta.organisms[0] ? shortOrganism(meta.organisms[0]) : "",
      }).replace(/\s+/g, " "),
    [locale, meta],
  );

  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: "thinking" });
    try {
      const answer = await askAi(q, locale, meta, asOf, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const f = answer.filters;
      const chosen: Chosen = {};
      if (f.ward) chosen.ward = f.ward;
      if (f.specimen) chosen.specimen = f.specimen;
      if (f.organism) chosen.organism = f.organism;
      if (f.sex) chosen.sex = f.sex;
      const band = toBand(f.ageGroup);
      if (band) chosen.age = band;
      if (f.onset) chosen.onset = f.onset;
      if (f.period) chosen.period = f.period;
      setPhase({ kind: "answer", chosen, unmatched: answer.unmatched, intent: answer.intent });
    } catch (err) {
      if (controller.signal.aborted) return;
      const code: AiErrorCode = err instanceof AiError ? err.code : "network";
      if (code === "aborted") setPhase({ kind: "idle" });
      else setPhase({ kind: "error", code });
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(text);
  }

  function update(patch: Partial<Chosen>) {
    setPhase((p) => {
      if (p.kind !== "answer") return p;
      const chosen: Chosen = { ...p.chosen, ...patch };
      for (const k of Object.keys(patch) as (keyof Chosen)[]) if (patch[k] === undefined) delete chosen[k];
      return { ...p, chosen };
    });
  }

  const errorText = (code: AiErrorCode) =>
    code === "timeout"
      ? t(locale, "common.ask.timeout")
      : code === "busy"
        ? t(locale, "common.ask.busy")
        : code === "unreadable"
          ? t(locale, "common.ask.unreadable")
          : t(locale, "common.ask.error");

  const answer = phase.kind === "answer" ? phase : null;
  const chosen = answer?.chosen ?? {};
  const hasFilters = Object.keys(chosen).some((k) => k !== "period");

  // The doctor's list is the server's (D-023): unit, site and sex. Bacteria, age and onset go to the report.
  function treatPatch(): Partial<TreatPrefs> {
    const p: Partial<TreatPrefs> = {};
    if (chosen.ward) p.ward = chosen.ward;
    if (chosen.specimen) p.specimen = chosen.specimen;
    if (chosen.sex) p.sex = chosen.sex;
    return p;
  }
  function reportPatch(): Partial<ReportPrefs> {
    const p: Partial<ReportPrefs> = {};
    if (chosen.ward) p.ward = chosen.ward;
    if (chosen.specimen) p.specimen = chosen.specimen;
    if (chosen.organism) p.organism = chosen.organism;
    if (chosen.sex) p.sex = chosen.sex;
    if (chosen.age) p.age = chosen.age;
    return p;
  }

  const reportFirst = answer?.intent === "signals";

  const footer = answer ? (
    <div className="k-ask-actions">
      <button
        type="button"
        className={`k-btn ${reportFirst ? "is-secondary" : "is-primary"}`}
        disabled={!hasFilters}
        onClick={() => {
          onShowTreat(treatPatch());
          onClose();
        }}
      >
        {t(locale, "common.ask.showTreat")}
      </button>
      <button
        type="button"
        className={`k-btn ${reportFirst ? "is-primary" : "is-secondary"}`}
        disabled={!hasFilters}
        onClick={() => {
          onOpenReport(reportPatch());
          onClose();
        }}
      >
        {t(locale, "common.ask.openReport")}
      </button>
    </div>
  ) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      locale={locale}
      title={
        <span className="k-ask-title">
          <Icon name="sparkle" size={20} />
          {t(locale, "common.ask.title")}
        </span>
      }
      subtitle={t(locale, "common.ask.note")}
      size="md"
      footer={footer}
    >
      <form className="k-ask-form" onSubmit={onSubmit}>
        <label className="u-sr" htmlFor="k-ask-input">
          {t(locale, "common.ask.title")}
        </label>
        <textarea
          id="k-ask-input"
          className="k-ask-input"
          value={text}
          rows={2}
          maxLength={400}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(text);
            }
          }}
          enterKeyHint="send"
        />
        {phase.kind === "thinking" ? (
          <button type="button" className="k-btn is-secondary k-ask-send" onClick={() => abort.current?.abort()}>
            {t(locale, "common.ask.stop")}
          </button>
        ) : (
          <button type="submit" className="k-btn is-primary k-ask-send" disabled={!text.trim()}>
            <Icon name="send" size={18} />
            {t(locale, "common.ask.send")}
          </button>
        )}
      </form>

      {phase.kind === "idle" ? (
        <div className="k-field">
          <span className="k-field-label">{t(locale, "common.ask.examples")}</span>
          <div className="k-chips">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className="k-chip is-example"
                onClick={() => {
                  setText(ex);
                  void ask(ex);
                }}
              >
                <span className="k-chip-text">{ex}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase.kind === "thinking" ? (
        <div className="k-ask-thinking" role="status">
          <span className="k-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {t(locale, "common.ask.thinking")}
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="k-ask-error" role="alert">
          <Icon name="info" size={18} />
          <span>{errorText(phase.code)}</span>
        </div>
      ) : null}

      {answer ? (
        <div className="k-ask-answer" aria-live="polite">
          <div className="u-eyebrow">{t(locale, "common.ask.understood")}</div>
          {Object.keys(chosen).length === 0 ? (
            <p className="k-ask-nothing">{t(locale, "common.ask.nothing")}</p>
          ) : (
            <div className="k-chips">
              {chosen.ward !== undefined ? (
                <Picker
                  variant="chip"
                  locale={locale}
                  label={t(locale, "common.ask.unit")}
                  value={chosen.ward}
                  nullLabel={t(locale, "common.chip.any")}
                  groups={[{ options: meta.units.map((u) => ({ value: u.code, label: named(locale, u) })) }]}
                  onChange={(v) => update({ ward: v ?? undefined })}
                />
              ) : null}
              {chosen.specimen !== undefined ? (
                <Picker
                  variant="chip"
                  locale={locale}
                  label={t(locale, "common.ask.site")}
                  value={chosen.specimen}
                  groups={[{ options: meta.specimens.map((s) => ({ value: s.code, label: named(locale, s) })) }]}
                  nullLabel={t(locale, "common.chip.any")}
                  onChange={(v) => update({ specimen: v ?? undefined })}
                />
              ) : null}
              {chosen.organism !== undefined ? (
                <Picker
                  variant="chip"
                  locale={locale}
                  label={t(locale, "common.ask.organism")}
                  value={chosen.organism}
                  groups={[{ options: meta.organisms.map((o) => ({ value: o, label: <Org name={o} />, text: o })) }]}
                  nullLabel={t(locale, "common.chip.any")}
                  onChange={(v) => update({ organism: v ?? undefined })}
                />
              ) : null}
              {chosen.sex !== undefined ? (
                <Picker
                  variant="chip"
                  locale={locale}
                  label={t(locale, "common.ask.sex")}
                  value={chosen.sex}
                  groups={[{ options: sexes.map((s) => ({ value: s, label: sexLabel(locale, s) })) }]}
                  nullLabel={t(locale, "common.chip.any")}
                  onChange={(v) => update({ sex: v ?? undefined })}
                />
              ) : null}
              {chosen.age !== undefined ? (
                <Picker<AgeBand>
                  variant="chip"
                  locale={locale}
                  label={t(locale, "common.ask.age")}
                  value={chosen.age}
                  groups={[{ options: (["under65", "65plus"] as const).map((b) => ({ value: b, label: ageLabel(locale, b) })) }]}
                  nullLabel={t(locale, "common.chip.any")}
                  onChange={(v) => update({ age: v ?? undefined })}
                />
              ) : null}
              {chosen.onset !== undefined ? (
                <Picker<Onset>
                  variant="chip"
                  locale={locale}
                  label={t(locale, "common.ask.onset")}
                  value={chosen.onset}
                  groups={[{ options: (["community", "hospital"] as const).map((o) => ({ value: o, label: onsetLabel(locale, o) })) }]}
                  nullLabel={t(locale, "common.chip.any")}
                  onChange={(v) => update({ onset: v ?? undefined })}
                />
              ) : null}
              {chosen.period ? (
                <RemovableChip
                  kind={t(locale, "common.ask.period")}
                  label={t(locale, "common.ask.periodValue", {
                    from: formatDate(locale, chosen.period.from),
                    to: formatDate(locale, chosen.period.to, "long"),
                  })}
                  removeLabel={t(locale, "common.ask.remove", { label: t(locale, "common.ask.period") })}
                  onRemove={() => update({ period: undefined })}
                />
              ) : null}
            </div>
          )}
          {chosen.period ? (
            <p className="k-ask-line">
              {chosen.period.clamped ? `${t(locale, "common.ask.cut", { date: formatDate(locale, meta.start, "long") })}. ` : ""}
              {t(locale, "common.ask.periodNote")}
            </p>
          ) : null}
          {answer.unmatched.length > 0 ? (
            <p className="k-ask-line">{t(locale, "common.ask.unmatched", { words: answer.unmatched.join(", ") })}</p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
