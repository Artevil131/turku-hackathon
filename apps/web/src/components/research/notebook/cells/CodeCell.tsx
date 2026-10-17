import { type Locale, t } from "@aei/i18n";
import { useState } from "react";
import type { CellResult } from "../../tools/model.ts";
import { type CodeCell, codeFor, type Lang } from "../model.ts";
import { useCopy } from "../useCopy.ts";

// A code cell: Python or R, prefilled from the nearest analysis above, edited in a monospace field. It does not
// run here: "Open in Reproduce" copies the code and shows the Reproduce window (JupyterLite), where it runs.

const LANG_NAME: Record<Lang, string> = { python: "Python", r: "R" };

export function CodeCellBody({
  cell,
  locale,
  above,
  aboveName,
  onChange,
  onReproduce,
}: {
  cell: CodeCell;
  locale: Locale;
  /** The nearest analysis above that has run, for the prefill. */
  above: CellResult | null;
  aboveName: string;
  onChange: (patch: Partial<CodeCell>) => void;
  onReproduce: (lang: Lang) => void;
}) {
  const { id, lang, code, edited } = cell;
  const [copyState, copy] = useCopy();
  const [sent, setSent] = useState(false);
  const switchTo = (next: Lang) => {
    if (next === lang) return;
    // The untouched prefill follows the language; the researcher's own code stays.
    onChange(!edited && above ? { lang: next, code: codeFor(above, next) } : { lang: next });
  };
  const rows = Math.min(18, Math.max(4, code.split("\n").length + 1));
  return (
    <div className="nb-code">
      <div className="nb-code-head">
        <div className="nb-seg" role="group" aria-label={t(locale, "nbKindCode")}>
          {(["python", "r"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => switchTo(l)}>
              {LANG_NAME[l]}
            </button>
          ))}
        </div>
        <div className="nb-actions">
          <button type="button" className="btn nb-small" disabled={!code.trim()} onClick={() => copy(code)}>
            {copyState === "copied" ? t(locale, "nbCopied") : copyState === "manual" ? t(locale, "nbCopyManual") : t(locale, "nbCopy")}
          </button>
          <button
            type="button"
            className="btn btn-primary nb-small"
            data-open-reproduce
            onClick={async () => {
              await copy(code);
              setSent(true);
              onReproduce(lang);
            }}
          >
            {t(locale, "nbOpenReproduce")}
          </button>
        </div>
      </div>
      <textarea
        id={`${id}-code`}
        className="nb-code-edit"
        aria-label={t(locale, "nbCodeLabel", { lang: LANG_NAME[lang] })}
        value={code}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange({ code: e.target.value, edited: true })}
        onKeyDown={(e) => {
          // Tab indents inside the code; Escape leaves the field so Tab moves on again.
          if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: a, selectionEnd: b } = el;
            const next = `${code.slice(0, a)}    ${code.slice(b)}`;
            onChange({ code: next, edited: true });
            requestAnimationFrame(() => el.setSelectionRange(a + 4, a + 4));
          } else if (e.key === "Escape") e.currentTarget.blur();
        }}
      />
      <p className="nb-muted" aria-live="polite">
        {sent && copyState !== "idle"
          ? t(locale, "nbReproduceCopied")
          : edited
            ? t(locale, "nbCodeOwn")
            : above
              ? t(locale, "nbCodeFrom", { tool: aboveName })
              : t(locale, "nbCodeNone")}
      </p>
    </div>
  );
}
