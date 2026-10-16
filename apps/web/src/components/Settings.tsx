import { type Locale, t } from "@aei/i18n";

// Settings: things a user sets once. Kept off the working pages.

interface Props {
  locale: Locale;
  onLocale: (l: Locale) => void;
  onResetRole: () => void;
}

export function Settings({ locale, onLocale, onResetRole }: Props) {
  return (
    <main className="settings glass ply-2">
      <h1 className="result-title">{t(locale, "settings")}</h1>

      <fieldset className="field setting">
        <legend className="field-label">{t(locale, "language")}</legend>
        <div className="choice-row">
          {(
            [
              ["fi", "Suomi"],
              ["en", "English"],
            ] as [Locale, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="choice"
              aria-pressed={locale === value}
              onClick={() => onLocale(value)}
              lang={value}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field setting">
        <span className="field-label">{t(locale, "roleSetting")}</span>
        <p className="field-hint">{t(locale, "roleSettingHint")}</p>
        <button type="button" className="btn" onClick={onResetRole}>
          {t(locale, "forgetRole")}
        </button>
      </div>

      <div className="field setting">
        <span className="field-label">{t(locale, "aboutData")}</span>
        <p className="field-hint">{t(locale, "aboutDataText")}</p>
      </div>
    </main>
  );
}
