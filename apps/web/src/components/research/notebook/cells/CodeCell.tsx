import { type Locale, t } from "@aei/i18n";
import { useEffect, useState } from "react";
import type { CellResult } from "../../tools/model.ts";
import { apiOrigin, type CellRun, kernel, lastLine, type Output, outputText, parseTable, useKernel } from "../kernel.ts";
import { type CodeCell, codeFor, type Lang } from "../model.ts";
import { useCopy } from "../useCopy.ts";

// A code cell: Python or R, prefilled from the nearest analysis above, edited in a monospace field. Python runs
// here, in the page's kernel (kernel.ts); R runs in the Reproduce window, which "Open in Reproduce" shows with the
// code copied. The last output is kept as text, so a reload shows it marked as from an earlier run.

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
  const k = useKernel();
  const run: CellRun | undefined = k.runs[id];
  const busy = run?.status === "queued" || run?.status === "running";
  const python = lang === "python";
  const switchTo = (next: Lang) => {
    if (next === lang) return;
    // The untouched prefill follows the language; the researcher's own code stays.
    onChange(!edited && above ? { lang: next, code: codeFor(above, next) } : { lang: next });
  };
  const go = async () => {
    if (!python || !code.trim()) return;
    const r = await kernel.run(id, code);
    if (r.status === "done" && (r.outputs.length > 0 || cell.last))
      onChange({ last: { text: outputText(r.outputs), error: r.outputs.some((o) => o.kind === "error") } });
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
            className={python ? "btn nb-small" : "btn btn-primary nb-small"}
            data-open-reproduce
            onClick={async () => {
              await copy(code);
              setSent(true);
              onReproduce(lang);
            }}
          >
            {t(locale, "nbOpenReproduce")}
          </button>
          {python &&
            (busy ? (
              <button type="button" className="btn nb-small" data-stop onClick={() => kernel.interrupt()}>
                {t(locale, "nbStop")}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary nb-small"
                data-run
                disabled={!code.trim()}
                title={t(locale, "nbRunHint")}
                onClick={() => void go()}
              >
                {t(locale, "nbRun")}
              </button>
            ))}
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
          // Shift+Enter runs; Tab indents inside the code; Escape leaves the field so Tab moves on again.
          if (e.key === "Enter" && e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            if (!busy) void go();
          } else if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
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
          : [
              edited ? t(locale, "nbCodeOwn") : above ? t(locale, "nbCodeFrom", { tool: aboveName }) : t(locale, "nbCodeNone"),
              python ? t(locale, "nbPyData", { url: apiOrigin() }) : t(locale, "nbRRunsThere"),
            ].join(" ")}
      </p>
      {python && <RunStatusLine locale={locale} run={run} />}
      {python && run && run.outputs.length > 0 ? (
        <Outputs locale={locale} outputs={run.outputs} />
      ) : python && !run && cell.last ? (
        <div className="nb-out" data-earlier>
          <p className="nb-out-label">{t(locale, "nbEarlierRun")}</p>
          {cell.last.text ? <pre className={cell.last.error ? "nb-out-text nb-out-error" : "nb-out-text"}>{cell.last.text}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

/** One line while this cell waits: Python starting (with the seconds), another cell running, a stop, a failed start. */
function RunStatusLine({ locale, run }: { locale: Locale; run: CellRun | undefined }) {
  const k = useKernel();
  const starting = k.phase === "starting" && run?.status === "queued";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!starting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [starting]);
  let text = "";
  if (starting) text = t(locale, "nbPyStarting", { s: Math.max(0, Math.round((now - k.since) / 1000)) });
  else if (run?.status === "queued") text = t(locale, "nbPyQueued");
  else if (run?.status === "stopped") text = t(locale, "nbPyStopped");
  else if (k.phase === "failed" && run && !run.ok && run.outputs.length === 0) text = t(locale, "nbPyFailed", { error: k.error });
  return text ? (
    <p className="nb-run-status" role="status">
      {text}
    </p>
  ) : null;
}

function Outputs({ locale, outputs }: { locale: Locale; outputs: readonly Output[] }) {
  // Consecutive stream chunks read as one block of text.
  const merged: Output[] = [];
  for (const o of outputs) {
    const prev = merged[merged.length - 1];
    if (o.kind === "stream" && prev?.kind === "stream") merged[merged.length - 1] = { kind: "stream", text: prev.text + o.text };
    else merged.push(o);
  }
  let figure = 0;
  return (
    <div className="nb-out" data-output>
      {merged.map((o, i) => {
        const key = `${o.kind}${i}`;
        switch (o.kind) {
          case "stream":
          case "result":
            return (
              <pre key={key} className="nb-out-text">
                {o.text.replace(/\n$/, "")}
              </pre>
            );
          case "table":
            return <OutTable key={key} locale={locale} html={o.html} rows={o.rows} cols={o.cols} />;
          case "image":
            figure++;
            return (
              <img key={key} className="nb-out-img" src={`data:image/png;base64,${o.png}`} alt={t(locale, "nbFigure", { n: figure })} />
            );
          default:
            return (
              <div key={key} className="nb-out-err">
                <pre className="nb-out-text nb-out-error">{lastLine(o.traceback)}</pre>
                {o.traceback.trim() !== lastLine(o.traceback) && (
                  <details>
                    <summary>{t(locale, "nbTraceback")}</summary>
                    <pre className="nb-out-text">{o.traceback.replace(/\n$/, "")}</pre>
                  </details>
                )}
              </div>
            );
        }
      })}
    </div>
  );
}

/** A DataFrame as a table of text: pandas' HTML is read for its cells only, never inserted as markup. */
function OutTable({ locale, html, rows, cols }: { locale: Locale; html: string; rows: number; cols: number }) {
  const { head, body } = parseTable(html);
  return (
    <div className="nb-out-table">
      <div className="nb-out-scroll">
        <table>
          <thead>
            {head.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows of a fixed table
              <tr key={i}>
                {r.map((c, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells of a fixed row
                  <th key={j} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {body.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows of a fixed table
              <tr key={i}>
                {r.map((c, j) =>
                  j === 0 ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells of a fixed row
                    <th key={j} scope="row">
                      {c}
                    </th>
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells of a fixed row
                    <td key={j}>{c}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nb-muted">{t(locale, "nbRows", { shown: Math.min(rows, body.length), rows, cols })}</p>
    </div>
  );
}
