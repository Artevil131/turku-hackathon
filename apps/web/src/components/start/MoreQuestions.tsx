import { type Locale, t } from "@aei/i18n";
import { ProjectDialog } from "../research/projects/ProjectDialog.tsx";
import type { Chip, ChipAction } from "./roles.ts";

/** A small window in the middle of the page: the questions people in this role ask, one click to the answer. */
export function MoreQuestions({
  locale,
  questions,
  onPick,
  onClose,
}: {
  locale: Locale;
  questions: Chip[];
  onPick: (action: ChipAction) => void;
  onClose: () => void;
}) {
  return (
    <ProjectDialog title={t(locale, "qMoreTitle")} closeLabel={t(locale, "qMoreClose")} onClose={onClose}>
      <p className="start-more-note">{t(locale, "qMoreNote")}</p>
      <ul className="start-more">
        {questions.map((q) => (
          <li key={q.label}>
            <button type="button" onClick={() => onPick(q.action)}>
              <span>{t(locale, q.label)}</span>
              <i aria-hidden="true">›</i>
            </button>
          </li>
        ))}
      </ul>
    </ProjectDialog>
  );
}
