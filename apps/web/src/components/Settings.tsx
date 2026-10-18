import { type Locale, siteName, t } from "@aei/i18n";
import { useSites } from "../sites.ts";
import { InfoButton } from "./Info.tsx";

// Settings: things a user sets once: the language, the hospital, the Start-as preset (which also sets the
// density). The data checks moved to Data.

interface Props {
  locale: Locale;
  onLocale: (l: Locale) => void;
  /** Starts the two-minute product showcase (a drawn cursor walks the whole product, for a screen recording). */
  onShowcase?: () => void;
}

export function Settings({ locale, onLocale, onShowcase }: Props) {
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

      {onShowcase ? (
        <div className="field setting">
          <span className="field-label">
            {t(locale, "demoShowcase")}
            <InfoButton locale={locale}>{t(locale, "demoShowcaseHint")}</InfoButton>
          </span>
          <button type="button" className="btn" data-showcase onClick={onShowcase}>
            {t(locale, "demoShowcaseStart")} · 2 min
          </button>
        </div>
      ) : null}

      <button type="button" className="settings-reset" onClick={resetAsFirstVisit}>
        reset
      </button>
    </section>
  );
}

// Hidden dev control: forget everything this browser remembers and reload at the start page.
function resetAsFirstVisit() {
  if (!window.confirm("Forget everything stored in this browser and reload as a first-time visitor?")) return;
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // storage blocked: nothing to forget
  }
  window.location.replace(window.location.pathname);
  window.location.reload();
}
