import type { AeiClient, SiteStatus, SitesResponse } from "@aei/contract";
import { formatDate, type Locale, siteName, t } from "@aei/i18n";
import { COUNTIES } from "@aei/sites";
import { useEffect, useMemo, useState } from "react";
import { useSites } from "../../sites.ts";

// The Connect page's hospitals (D-051): every site on this server with its status, rows and feed, and a
// panel that writes a new site's sites.json entry with a fresh token made in the browser (sent nowhere).

const num = (locale: Locale, n: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB").format(n);
const FORMAT_LABEL = { hl7v2: "HL7 v2", fhir: "FHIR R4", csv: "CSV" } as const;
const shortCounty = (c: string) => c.replace(/n hyvinvointialue$/, "").replace(/ hyvinvointialue$/, "");

function statusOf(s: SiteStatus): {
  status: "on" | "ready" | "off";
  key: "connectSiteHome" | "connectSiteConnected" | "connectSiteAwaiting";
} {
  if (s.status === "home") return { status: "on", key: "connectSiteHome" };
  if (s.status === "connected") return { status: "ready", key: "connectSiteConnected" };
  return { status: "off", key: "connectSiteAwaiting" };
}

export function SiteList({ client, locale }: { client: AeiClient; locale: Locale }) {
  const { site } = useSites();
  const [data, setData] = useState<SitesResponse | null>(null);
  useEffect(() => {
    let live = true;
    client.sites().then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [client]);
  if (!data) return null;
  // The selected hospital first, then the home site, then the rest in file order.
  const sites = [...data.sites].sort((a, b) => Number(b.id === site) - Number(a.id === site));
  return (
    <section aria-labelledby="cx-sites-title">
      <h2 id="cx-sites-title" className="cx-h2">
        {t(locale, "connectSitesTitle")}
      </h2>
      <p className="cx-lead">{t(locale, "connectSitesLead")}</p>
      <ul className="cx-grid">
        {sites.map((s) => {
          const st = statusOf(s);
          const f = s.feed;
          return (
            <li key={s.id} className="cx-source" data-status={st.status} data-current={s.id === site}>
              <div className="cx-source-head">
                <h3>
                  {siteName(locale, s.id)} <span className="cx-site-id">{s.id}</span>
                </h3>
                <span className="cx-status" data-status={st.status}>
                  <i aria-hidden="true" />
                  {t(locale, st.key)}
                </span>
              </div>
              <p>
                {t(locale, "connectSiteCounts", {
                  cultures: num(locale, s.counts.cultures),
                  isolates: num(locale, s.counts.isolates),
                  patients: num(locale, s.counts.patients),
                  date: formatDate(locale, data.asOf),
                  units: s.wards.length,
                })}
              </p>
              <p>
                {f.messages && f.lastAt
                  ? t(locale, "connectSiteFeed", {
                      messages: num(locale, f.messages),
                      at: new Date(f.lastAt).toLocaleString(locale === "fi" ? "fi-FI" : "en-GB"),
                      format: f.lastFormat ? FORMAT_LABEL[f.lastFormat] : "?",
                      accepted: num(locale, f.lastAccepted),
                    })
                  : s.status === "home"
                    ? t(locale, "connectSiteHomeFeed")
                    : t(locale, "connectSiteNoFeed")}
              </p>
              {f.warnings || f.unregistered || f.rejected ? (
                <p className="cx-site-issues">
                  {t(locale, "connectSiteIssues", { warnings: f.warnings, unregistered: f.unregistered, rejected: f.rejected })}
                </p>
              ) : null}
              <p className="cx-site-county">{t(locale, "connectSiteCounty", { county: shortCounty(s.county) })}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 32 random bytes as hex, from the browser's cryptographic generator. */
function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const DEFAULT_UNITS = "ICU; Teho-osasto; Intensive care unit; in\nURO; Urologia; Urology; in\nED; Päivystys; Emergency department; out";

type Unit = { code: string; fi: string; en: string; type: "in" | "out"; institution: "hospital" | "primary_care" };

function parseUnits(text: string): { units: Unit[]; bad: number | null } {
  const units: Unit[] = [];
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) continue;
    const [code, fi, en, type, institution] = line.split(";").map((x) => x.trim());
    if (!code || code.includes("/") || !fi || !en || (type !== "in" && type !== "out")) return { units, bad: i + 1 };
    units.push({ code, fi, en, type, institution: institution === "primary_care" ? "primary_care" : "hospital" });
  }
  return { units, bad: null };
}

function Copy({ locale, text }: { locale: Locale; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn cx-copy"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => {},
        )
      }
    >
      {done ? t(locale, "connectAddCopied") : t(locale, "connectAddCopy")}
    </button>
  );
}

export function ConnectHospital({ locale }: { locale: Locale }) {
  const { sites } = useSites();
  const [id, setId] = useState("vaasa");
  const [fi, setFi] = useState("Vaasan keskussairaala");
  const [en, setEn] = useState("Vaasa Central Hospital");
  const [county, setCounty] = useState("Pohjanmaan hyvinvointialue");
  const [unitsText, setUnitsText] = useState(DEFAULT_UNITS);
  const [token, setToken] = useState(newToken);

  const taken = sites.some((s) => s.id === id);
  const idProblem = !ID.test(id) ? "connectAddIdInvalid" : taken ? "connectAddIdTaken" : null;
  const { units, bad } = useMemo(() => parseUnits(unitsText), [unitsText]);
  const entry = JSON.stringify({ id, fi, en, county, token, wards: units }, null, 2);
  const api = (import.meta.env.VITE_AEI_API_URL as string | undefined) || location.origin;
  const endpoint = `${api.replace(/\/$/, "")}/api/ingest`;
  const curl = (type: string, file: string) =>
    `curl -X POST ${endpoint} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: ${type}" \\\n  --data-binary @${file}`;
  const example = `${id || "site"}/${units[0]?.code ?? "ICU"}`;

  return (
    <section className="cx-try cx-add" aria-labelledby="cx-add-title">
      <h2 id="cx-add-title" className="cx-h2">
        {t(locale, "connectAddTitle")}
      </h2>
      <p className="cx-lead">{t(locale, "connectAddLead")}</p>
      <ol className="cx-steps">
        <li>{t(locale, "connectAddStep1")}</li>
        <li>{t(locale, "connectAddStep2")}</li>
        <li>{t(locale, "connectAddStep3")}</li>
        <li>{t(locale, "connectAddStep4")}</li>
      </ol>

      <div className="cx-form">
        <label className="cx-field">
          <span className="cx-label">{t(locale, "connectAddId")}</span>
          <input
            className="cx-input"
            value={id}
            onChange={(e) => setId(e.target.value.trim())}
            aria-invalid={idProblem ? true : undefined}
            aria-describedby={idProblem ? "cx-add-id-problem" : undefined}
            spellCheck={false}
          />
          {idProblem ? (
            <span id="cx-add-id-problem" className="cx-problem">
              {t(locale, idProblem)}
            </span>
          ) : null}
        </label>
        <label className="cx-field">
          <span className="cx-label">{t(locale, "connectAddNameFi")}</span>
          <input className="cx-input" value={fi} onChange={(e) => setFi(e.target.value)} lang="fi" />
        </label>
        <label className="cx-field">
          <span className="cx-label">{t(locale, "connectAddNameEn")}</span>
          <input className="cx-input" value={en} onChange={(e) => setEn(e.target.value)} lang="en" />
        </label>
        <label className="cx-field">
          <span className="cx-label">{t(locale, "connectAddCounty")}</span>
          <select className="cx-input" value={county} onChange={(e) => setCounty(e.target.value)}>
            {COUNTIES.map((c) => (
              <option key={c} value={c}>
                {shortCounty(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="cx-field cx-field-wide">
          <span className="cx-label">{t(locale, "connectAddUnits")}</span>
          <textarea
            className="cx-message cx-units"
            value={unitsText}
            onChange={(e) => setUnitsText(e.target.value)}
            spellCheck={false}
            aria-invalid={bad ? true : undefined}
            aria-describedby={bad ? "cx-add-units-problem" : undefined}
          />
          {bad ? (
            <span id="cx-add-units-problem" className="cx-problem">
              {t(locale, "connectAddUnitsInvalid", { line: bad })}
            </span>
          ) : null}
        </label>
      </div>

      <div className="cx-out-head">
        <h3 className="cx-h3">{t(locale, "connectAddEntry")}</h3>
        <span className="cx-out-tools">
          <button type="button" className="btn" onClick={() => setToken(newToken())}>
            {t(locale, "connectAddToken")}
          </button>
          <Copy locale={locale} text={entry} />
        </span>
      </div>
      <pre className="cx-code">
        <code>{entry}</code>
      </pre>
      <p className="cx-note">{t(locale, "connectAddTokenNote")}</p>

      <h3 className="cx-h3">{t(locale, "connectAddEndpoint")}</h3>
      <pre className="cx-code">
        <code>{endpoint}</code>
      </pre>
      <h3 className="cx-h3">{t(locale, "connectAddExamples")}</h3>
      {(
        [
          ["HL7 v2", "x-application/hl7-v2+er7", "lab-report.hl7"],
          ["FHIR R4", "application/fhir+json", "lab-report.fhir.json"],
          ["CSV", "text/csv", "lab-report.csv"],
        ] as const
      ).map(([label, type, file]) => (
        <div key={label}>
          <div className="cx-out-head">
            <span className="cx-k">{label}</span>
            <Copy locale={locale} text={curl(type, file)} />
          </div>
          <pre className="cx-code">
            <code>{curl(type, file)}</code>
          </pre>
        </div>
      ))}
      <p className="cx-lead">{t(locale, "connectAddQualified", { id: id || "site", example })}</p>
    </section>
  );
}
