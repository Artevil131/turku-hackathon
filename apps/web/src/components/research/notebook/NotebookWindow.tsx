import { type Locale, t } from "@aei/i18n";
import type { Project } from "@aei/projects";
import { useState } from "react";
import { connectSnippet, notebookHref } from "./notebook.ts";
import "./NotebookWindow.css";

// The Notebook window (D-062): the JupyterLite site embedded beside the signals, showing the open project's
// notebook. Without a project in the hash it explains how to open one and gives the snippet to copy.

export function NotebookWindow({ locale, projectId, project }: { locale: Locale; projectId: string | null; project: Project | null }) {
  const origin = typeof location === "undefined" ? "" : location.origin;
  const snippet = connectSnippet(origin, projectId);
  const [copied, setCopied] = useState(false);

  if (!projectId) {
    return (
      <section className="nb nb-empty" aria-label={t(locale, "boardNotebook")}>
        <p className="nb-empty-title">{t(locale, "nbEmpty")}</p>
        <p className="nb-empty-hint">{t(locale, "nbEmptyHint")}</p>
        <CopySnippet locale={locale} snippet={snippet} copied={copied} onCopied={setCopied} />
      </section>
    );
  }

  const cut = project?.mode === "frozen" ? t(locale, "nbCutFrozen", { date: project.asOf ?? "" }) : t(locale, "nbCutContinuous");
  const name = project?.name ?? projectId;
  return (
    <section className="nb" aria-label={t(locale, "boardNotebook")}>
      <header className="nb-head">
        <p className="nb-line">
          <strong>{name}</strong>
          <span className="nb-sep" aria-hidden="true">
            ·
          </span>
          <span>{cut}</span>
        </p>
        <a className="nb-open" href={notebookHref(projectId)} target="_blank" rel="noopener">
          {t(locale, "nbOpenTab")}
        </a>
      </header>
      <iframe className="nb-frame" src={notebookHref(projectId)} title={`${t(locale, "boardNotebook")}: ${name}`} />
      <CopySnippet locale={locale} snippet={snippet} copied={copied} onCopied={setCopied} />
    </section>
  );
}

function CopySnippet({
  locale,
  snippet,
  copied,
  onCopied,
}: {
  locale: Locale;
  snippet: string;
  copied: boolean;
  onCopied: (on: boolean) => void;
}) {
  const copy = () => {
    const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clip) return;
    clip.writeText(snippet).then(
      () => onCopied(true),
      () => onCopied(false),
    );
  };
  return (
    <div className="nb-snippet">
      <code>{snippet}</code>
      <button type="button" className="nb-copy" onClick={copy}>
        {copied ? t(locale, "nbCopied") : t(locale, "nbCopy")}
      </button>
    </div>
  );
}
