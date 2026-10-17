import { type Locale, siteName, t } from "@aei/i18n";
import { useSites } from "../sites.ts";
import { InfoButton } from "./Info.tsx";
import { AUDIENCE_KEYS, AUDIENCES, type Audience } from "./start/audience.ts";

// Settings: things a user sets once: the language, the hospital, the Start-as preset (which also sets the
// density). The data checks moved to Data.

interface Props {
  locale: Locale;
  onLocale: (l: Locale) => void;
  audience: Audience;
  onAudience: (a: Audience) => void;
}

export function Settings({ locale, onLocale, audience, onAudience }: Props) {
  const { sites, site, multi, setSite } = useSites();
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

      <fieldset className="field setting" data-audience>
        <legend className="field-label">
          {t(locale, "settingsAudience")}
          <InfoButton locale={locale}>{t(locale, "settingsAudienceHint")}</InfoButton>
        </legend>
        <div className="choice-row">
          {AUDIENCES.map((value) => (
            <button
              key={value}
              type="button"
              className="choice"
              aria-pressed={audience === value}
              data-audience-choice={value}
              onClick={() => onAudience(value)}
            >
              {t(locale, AUDIENCE_KEYS[value])}
            </button>
          ))}
        </div>
      </fieldset>

      {multi ? (
        <fieldset className="field setting">
          <legend className="field-label">
            {t(locale, "siteLabel")}
            <InfoButton locale={locale}>{t(locale, "siteSettingHint")}</InfoButton>
          </legend>
          <div className="choice-row">
            {[...sites.map((s) => s.id), null].map((id) => (
              <button key={id ?? "all"} type="button" className="choice" aria-pressed={site === id} onClick={() => setSite(id)}>
                {id === null ? t(locale, "siteAll") : siteName(locale, id)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="field setting">
        <span className="field-label">{t(locale, "shellData")}</span>
        <a className="btn" href="#data?section=quality">
          {t(locale, "dataQuality")}
        </a>
      </div>

      <div className="field setting">
        <a className="btn" href="#intro">
          {t(locale, "homeIntro")}
        </a>
      </div>
    </section>
  );
}
