import { countyName, type Locale, t } from "@aei/i18n";
import { COUNTIES } from "@aei/sites";
import { useMemo, useState } from "react";
import { useSites } from "../../sites.ts";

// "Connect a hospital" (D-051): numbered steps that write a new site's sites.json entry with a fresh token
// made in the browser (sent nowhere), the endpoint, curl examples and the demo-day command.

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

export function ConnectHospital({ locale }: { locale: Locale; site?: string }) {
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
  const demo = `uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-02 --format hl7 \\\n  --site ${id || "site"} --token ${token} --shared-patients 0.2 --url ${endpoint}`;

  return (
    <section className="cx-try cx-add" aria-labelledby="cx-add-title">
      <h2 id="cx-add-title" className="cx-h2" tabIndex={-1}>
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
                {countyName(locale, c)}
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

      <h3 id="cx-demo-title" className="cx-h3" tabIndex={-1}>
        {t(locale, "connectAddDemo")}
      </h3>
      <p className="cx-lead">{t(locale, "connectDemoCommand")}</p>
      <div className="cx-out-head">
        <span className="cx-k">scripts/send_lab_results.py</span>
        <Copy locale={locale} text={demo} />
      </div>
      <pre className="cx-code">
        <code>{demo}</code>
      </pre>
      <p className="cx-note">{t(locale, "connectAddDemoBody")}</p>
    </section>
  );
}
