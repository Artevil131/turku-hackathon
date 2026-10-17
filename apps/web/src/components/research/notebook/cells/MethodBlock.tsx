import { type Locale, t } from "@aei/i18n";
import { useState } from "react";
import type { CellResult } from "../../tools/model.ts";
import { codeFor, type Lang, lettersOf, methodFor } from "../model.ts";
import { useCopy } from "../useCopy.ts";
import "../notebook.css";

// The method under a result: the test's name, the formula (MathML, Copy LaTeX), this result's numbers in the
// formula's letters, then the constants with their decisions and the code in Python or R with Copy.

export function MethodBlock({ id, locale, result }: { id: string; locale: Locale; result: CellResult }) {
  const m = methodFor(result);
  const letters = lettersOf(result).show;
  const [lang, setLang] = useState<Lang>("python");
  const [latexState, copyLatex] = useCopy();
  const [codeState, copyCode] = useCopy();
  const code = codeFor(result, lang);
  const said = (s: "idle" | "copied" | "manual", idle: string) =>
    s === "copied" ? t(locale, "nbCopied") : s === "manual" ? t(locale, "nbCopyManual") : idle;
  const fmt = (v: number | string) =>
    typeof v === "number" ? (Number.isFinite(v) ? v.toLocaleString(locale, { maximumSignificantDigits: 6 }) : "–") : v;
  return (
    <div className="nb-method">
      <p className="nb-method-name">
        {m.name[locale]} <span className="nb-decision">{m.decisions.join(" · ")}</span>
      </p>
      <div className="nb-formula-row">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the MathML is the method registry's own text, not user input. */}
        <div className="nb-formula" dangerouslySetInnerHTML={{ __html: m.mathml }} />
        <button type="button" className="btn nb-small" onClick={() => copyLatex(m.latex)}>
          {said(latexState, t(locale, "nbCopyLatex"))}
        </button>
      </div>
      {latexState === "manual" && <pre className="nb-pre">{m.latex}</pre>}
      <dl className="nb-letters" aria-label={t(locale, "nbLetters")}>
        {letters.map(([sym, v]) => (
          <div key={sym}>
            <dt>{sym}</dt>
            <dd>{fmt(v)}</dd>
          </div>
        ))}
      </dl>
      <details className="nb-more">
        <summary>{t(locale, "nbConstantsCode")}</summary>
        <dl className="nb-constants">
          {m.constants.map((k) => (
            <div key={k.name}>
              <dt>{k.name}</dt>
              <dd>
                {fmt(k.value)} <span className="nb-decision">{k.decision}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="nb-code-head">
          <div className="nb-seg" role="group" aria-label={t(locale, "nbKindCode")}>
            <button type="button" aria-pressed={lang === "python"} onClick={() => setLang("python")}>
              Python
            </button>
            <button type="button" aria-pressed={lang === "r"} onClick={() => setLang("r")}>
              R
            </button>
          </div>
          <button type="button" className="btn nb-small" aria-describedby={`${id}-code`} onClick={() => copyCode(code)}>
            {said(codeState, t(locale, "nbCopy"))}
          </button>
        </div>
        <pre id={`${id}-code`} className="nb-pre">
          {code}
        </pre>
        <p className="nb-path">
          <code>{m.code.fn}</code> · <code>{m.code.ts}</code>
          {m.code.py ? (
            <>
              {" "}
              · <code>{m.code.py}</code>
            </>
          ) : null}
        </p>
      </details>
    </div>
  );
}
