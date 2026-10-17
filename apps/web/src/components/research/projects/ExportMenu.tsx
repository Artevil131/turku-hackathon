import { exportFormats } from "@aei/export";
import { type Locale, t } from "@aei/i18n";

export type ExportFormat = (typeof exportFormats)[number]["id"] | "svg" | "png";

export function ExportFormatButtons({
  locale,
  busy,
  onSelect,
}: {
  locale: Locale;
  busy: boolean;
  onSelect: (format: ExportFormat) => void;
}) {
  return (
    <div className="project-export-options" aria-busy={busy}>
      {exportFormats.map((format) => (
        <button type="button" role="menuitem" key={format.id} disabled={busy} onClick={() => onSelect(format.id)}>
          {t(locale, `exportFormat${format.id}`)}
        </button>
      ))}
      <button type="button" role="menuitem" disabled={busy} onClick={() => onSelect("svg")}>
        {t(locale, "exportSvg")}
      </button>
      <button type="button" role="menuitem" disabled={busy} onClick={() => onSelect("png")}>
        {t(locale, "exportPng")}
      </button>
    </div>
  );
}
