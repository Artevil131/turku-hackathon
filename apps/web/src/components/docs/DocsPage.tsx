import { type Locale, type MessageKey, t } from "@aei/i18n";
import { GUIDE, GUIDE_KINDS, type GuideKind } from "../../demo/tour/windowGuide.ts";
import type { WinId } from "../research/workspace/layout.ts";
import "./docs.css";

// The Docs page: what agar is for, then one entry per kind of window (what it shows, what to try, a button that
// opens a project with just that window). The copy is the window guide's, the same the tour speaks.

export function DocsPage({ locale, onShow }: { locale: Locale; onShow: (kind: WinId, title: MessageKey) => void }) {
  return (
    <div className="docs">
      <header className="docs-top">
        <h1>{t(locale, "docsTitle")}</h1>
        <p>{t(locale, "docsAbout")}</p>
        <a className="docs-method" href="#data?section=methods">
          {t(locale, "docsMethod")}
        </a>
      </header>
      <div className="docs-list">
        {GUIDE_KINDS.map((kind: GuideKind) => {
          const g = GUIDE[kind];
          return (
            <article key={kind} className="docs-win" data-kind={kind}>
              <h2>{t(locale, g.title)}</h2>
              <p>{t(locale, g.what)}</p>
              <ol>
                {g.tries.map((a) => (
                  <li key={a.say}>{t(locale, a.say)}</li>
                ))}
              </ol>
              {kind === "chart" ? null : (
                <button type="button" className="btn" title={t(locale, "docsShowTip")} onClick={() => onShow(kind, g.title)}>
                  {t(locale, "docsShow")}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
