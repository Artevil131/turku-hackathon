import { type Locale, siteName, t } from "@aei/i18n";
import { useSites } from "../sites.ts";
import { InfoButton } from "./Info.tsx";
import "./settings.css";

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

      <div className="settings-group">
        <div className="setting" role="group" aria-labelledby="setting-lang">
          <span className="setting-label" id="setting-lang">
            {t(locale, "language")}
          </span>
          <div className="seg">
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
        </div>

        {multi ? (
          <div className="setting" role="group" aria-labelledby="setting-site">
            <span className="setting-label" id="setting-site">
              {t(locale, "siteLabel")}
              <InfoButton locale={locale}>{t(locale, "siteSettingHint")}</InfoButton>
            </span>
            <div className="seg">
              {[...sites.map((s) => s.id), null].map((id) => (
                <button key={id ?? "all"} type="button" className="choice" aria-pressed={site === id} onClick={() => setSite(id)}>
                  {id === null ? t(locale, "siteAll") : siteName(locale, id)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="settings-group">
        <div className="setting">
          <span className="setting-label">{t(locale, "shellData")}</span>
          <a className="btn" href="#data?section=quality">
            {t(locale, "dataQuality")}
          </a>
        </div>

        <div className="setting">
          <span className="setting-label">{t(locale, "homeIntro")}</span>
          <a className="btn" href="#intro" aria-label={t(locale, "homeIntro")}>
            ▶
          </a>
        </div>

        {onShowcase ? (
          <div className="setting">
            <span className="setting-label">
              {t(locale, "demoShowcase")}
              <InfoButton locale={locale}>{t(locale, "demoShowcaseHint")}</InfoButton>
            </span>
            <button type="button" className="btn" data-showcase onClick={onShowcase}>
              {t(locale, "demoShowcaseStart")} · 2 min
            </button>
          </div>
        ) : null}
      </div>

      <div className="settings-group settings-danger">
        <div className="setting">
          <span className="setting-label">{t(locale, "settingsReset")}</span>
          <button type="button" className="btn settings-reset" onClick={() => resetAsFirstVisit(t(locale, "settingsResetConfirm"))}>
            {t(locale, "settingsResetAction")}
          </button>
        </div>
      </div>
    </section>
  );
}

// Hidden dev control: forget everything this browser remembers and reload at the start page.
function resetAsFirstVisit(confirmText: string) {
  if (!window.confirm(confirmText)) return;
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // storage blocked: nothing to forget
  }
  window.location.replace(window.location.pathname);
  window.location.reload();
}
