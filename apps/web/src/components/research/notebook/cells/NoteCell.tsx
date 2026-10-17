import { type Locale, t } from "@aei/i18n";
import { useEffect, useRef, useState } from "react";
import { NoteView } from "../markdown.tsx";

// A note: rendered Markdown; a click on it or its Edit button turns it into the textarea, saved as you type
// (the page saves on every change). Leaving the field, or Escape, shows it rendered again.

export function NoteCellBody({
  id,
  locale,
  text,
  autoEdit,
  onChange,
}: {
  id: string;
  locale: Locale;
  text: string;
  /** A new note opens in the editor. */
  autoEdit?: boolean;
  onChange: (text: string) => void;
}) {
  const [editing, setEditing] = useState(autoEdit === true);
  const area = useRef<HTMLTextAreaElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (editing) area.current?.focus();
  }, [editing]);
  const rows = Math.min(16, Math.max(3, text.split("\n").length + 1));
  if (editing)
    return (
      <textarea
        ref={area}
        id={`${id}-text`}
        className="nb-note-edit"
        aria-label={t(locale, "nbNoteEdit")}
        placeholder={t(locale, "nbNotePlaceholder")}
        value={text}
        rows={rows}
        spellCheck
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setEditing(false);
            requestAnimationFrame(() => edit.current?.focus());
          }
        }}
      />
    );
  return (
    <div className="nb-note-wrap">
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a click on the text is a shortcut; the Edit button is the keyboard's way in. */}
      <div
        className="nb-note"
        data-empty={text.trim() === "" || undefined}
        onClick={(e) => {
          // A selection being made, or a link, is not a request to edit.
          if (window.getSelection()?.toString()) return;
          if ((e.target as Element).closest("a")) return;
          setEditing(true);
        }}
      >
        {text.trim() ? <NoteView text={text} /> : <p className="nb-muted">{t(locale, "nbNoteEmpty")}</p>}
      </div>
      <button ref={edit} type="button" className="tl-link nb-note-btn" aria-controls={`${id}-text`} onClick={() => setEditing(true)}>
        {t(locale, "nbEdit")}
      </button>
    </div>
  );
}
