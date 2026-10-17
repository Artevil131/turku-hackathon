import { type Locale, t } from "@aei/i18n";
import { InfoButton } from "./Info.tsx";

// Settings: things a user sets once. Kept off the working pages.

interface Props {
  locale: Locale;
  onLocale: (l: Locale) => void;
  onResetRole: () => void;
}

export function Settings({ locale, onLocale, onResetRole }: Props) {
  return (
    <section className="settings glass" aria-labelledby="settings-title">
      <h1 id="settings-title" className="result-title">
        {t(locale, "settings")}
      </h1>

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
        <span className="field-label">
          {t(locale, "roleSetting")}
          <InfoButton locale={locale}>{t(locale, "roleSettingHint")}</InfoButton>
        </span>
        <button type="button" className="btn" onClick={onResetRole}>
          {t(locale, "forgetRole")}
        </button>
      </div>

      <div className="field setting">
        <span className="field-label">
          {t(locale, "aboutData")}
          <InfoButton locale={locale}>{t(locale, "aboutDataText")}</InfoButton>
        </span>
      </div>

      <div className="field setting">
        <a className="btn" href="#intro">
          {t(locale, "homeIntro")}
        </a>
      </div>
    </section>
  );
}
