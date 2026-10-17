import type { AeiClient } from "@aei/contract";
import { type Locale, type MessageKey, t } from "@aei/i18n";
import { type KeyboardEvent, useEffect, useState } from "react";
import { hashParams, writeHashParams } from "../../url.ts";
import { ConnectPage } from "../connect/ConnectPage.tsx";
import { DataQuality } from "../DataQuality.tsx";
import { MethodPage } from "../method/MethodPage.tsx";
import "./data.css";

// Data: one place for everything the tool reads (Connect before): the hospitals' feeds and how to send
// results, the regional (THL) and national (FinRes) sources, the user's own tables (browser only, D-066 (5)),
// the data checks, and the methods reference from the registry (D-066 (4)). The section is in the URL.

export const DATA_SECTIONS = ["feeds", "quality", "own", "methods"] as const;
export type DataSection = (typeof DATA_SECTIONS)[number];
const LABEL: Record<DataSection, MessageKey> = { feeds: "dataFeeds", quality: "dataQuality", own: "dataOwn", methods: "dataMethods" };

export function sectionFromHash(): DataSection {
  const value = hashParams().get("section");
  return DATA_SECTIONS.includes(value as DataSection) ? (value as DataSection) : "feeds";
}

export function DataPage({
  client,
  liveClient,
  locale,
  asOf,
}: {
  client: AeiClient;
  liveClient: AeiClient;
  locale: Locale;
  asOf: string | null;
}) {
  const [section, setSection] = useState<DataSection>(sectionFromHash);
  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const choose = (next: DataSection, focus = false) => {
    setSection(next);
    writeHashParams({ ...Object.fromEntries(hashParams()), section: next === "feeds" ? null : next });
    if (focus) document.getElementById(`data-tab-${next}`)?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = DATA_SECTIONS.indexOf(section);
    const to =
      e.key === "ArrowRight"
        ? (at + 1) % DATA_SECTIONS.length
        : e.key === "ArrowLeft"
          ? (at - 1 + DATA_SECTIONS.length) % DATA_SECTIONS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? DATA_SECTIONS.length - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    choose(DATA_SECTIONS[to] as DataSection, true);
  };
  return (
    <div className="data-page">
      <header className="data-head">
        <h1>{t(locale, "dataTitle")}</h1>
        <p>{t(locale, "dataLead")}</p>
      </header>
      <div className="data-tabs" role="tablist" aria-label={t(locale, "dataSections")} onKeyDown={onKey}>
        {DATA_SECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`data-tab-${id}`}
            aria-selected={section === id}
            aria-controls={`data-panel-${id}`}
            tabIndex={section === id ? 0 : -1}
            onClick={() => choose(id)}
          >
            {t(locale, LABEL[id])}
          </button>
        ))}
      </div>
      <section
        className="data-panel"
        role="tabpanel"
        id={`data-panel-${section}`}
        aria-labelledby={`data-tab-${section}`}
        data-section={section}
      >
        {section === "feeds" ? <ConnectPage client={liveClient} locale={locale} embedded /> : null}
        {section === "quality" ? (
          <div className="data-quality" id="data-quality">
            <h2>{t(locale, "aboutData")}</h2>
            <p className="data-note">{t(locale, "aboutDataText")}</p>
            <h3>{t(locale, "qualityTitle")}</h3>
            <DataQuality client={client} locale={locale} expanded />
          </div>
        ) : null}
        {section === "own" ? (
          <div className="data-own">
            <h2>{t(locale, "dataOwn")}</h2>
            <p className="data-note">{t(locale, "dataOwnLead")}</p>
            <div className="data-own-empty">
              <p>{t(locale, "dataOwnEmpty")}</p>
              <button type="button" disabled aria-describedby="data-own-soon">
                {t(locale, "dataAddTable")}
              </button>
              <small id="data-own-soon">{t(locale, "dataSoon")}</small>
            </div>
          </div>
        ) : null}
        {section === "methods" ? (
          <div className="data-methods">
            <p className="data-note">{t(locale, "dataMethodsLead")}</p>
            <MethodPage client={client} locale={locale} asOf={asOf} embedded />
          </div>
        ) : null}
      </section>
    </div>
  );
}
