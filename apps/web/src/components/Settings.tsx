import type { AeiClient } from "@aei/contract";
import { type Locale, siteName, t } from "@aei/i18n";
import { useEffect, useRef } from "react";
import { useSites } from "../sites.ts";
import { DataQuality } from "./DataQuality.tsx";
import { InfoButton } from "./Info.tsx";

// Settings: things a user sets once. Kept off the working pages.

interface Props {
  client: AeiClient;
  locale: Locale;
  onLocale: (l: Locale) => void;
  onResetRole: () => void;
}

export function Settings({ client, locale, onLocale, onResetRole }: Props) {
  const { sites, site, multi, setSite } = useSites();
  const dataRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (new URLSearchParams(location.hash.split("?")[1]).get("section") === "data") {
      dataRef.current?.scrollIntoView({ block: "start" });
      dataRef.current?.focus({ preventScroll: true });
    }
  }, []);
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
        <span className="field-label">
          {t(locale, "roleSetting")}
          <InfoButton locale={locale}>{t(locale, "roleSettingHint")}</InfoButton>
        </span>
        <button type="button" className="btn" onClick={onResetRole}>
          {t(locale, "forgetRole")}
        </button>
      </div>

      <section className="field setting" id="settings-data" ref={dataRef} tabIndex={-1} aria-labelledby="settings-data-title">
        <h2 className="field-label" id="settings-data-title">
          {t(locale, "aboutData")}
        </h2>
        <p>{t(locale, "aboutDataText")}</p>
        <h3 className="field-label">{t(locale, "qualityTitle")}</h3>
        <DataQuality client={client} locale={locale} expanded />
      </section>

      <div className="field setting">
        <a className="btn" href="#intro">
          {t(locale, "homeIntro")}
        </a>
      </div>
    </section>
  );
}
