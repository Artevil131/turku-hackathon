import type { AeiClient, Meta, QualityResponse, RegionalResponse } from "@aei/contract";
import { formatDate, type Locale, t } from "@aei/i18n";
import { detectFormat, type IngestFormat, type IngestResult, ingest } from "@aei/ingest";
import { useEffect, useState } from "react";
import "./connect.css";

// The Connect page: which data sources this server is connected to, checked live,
// which ones arrive through the same ingest route, and a message checker that runs
// the server's own reader (@aei/ingest) in the browser, so nothing is sent.

type Probe<T> = { state: "checking" } | { state: "ok"; data: T } | { state: "off" };

function useProbe<T>(load: () => Promise<T>): Probe<T> {
  const [probe, setProbe] = useState<Probe<T>>({ state: "checking" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: probed once per page visit
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setProbe({ state: "ok", data }),
      () => live && setProbe({ state: "off" }),
    );
    return () => {
      live = false;
    };
  }, []);
  return probe;
}

const FORMATS: { id: IngestFormat; label: string; file: string; type: string }[] = [
  { id: "hl7v2", label: "HL7 v2", file: "lab-report.hl7", type: "x-application/hl7-v2+er7" },
  { id: "fhir", label: "FHIR R4", file: "lab-report.fhir.json", type: "application/fhir+json" },
  { id: "csv", label: "CSV", file: "lab-report.csv", type: "text/csv" },
];

const num = (locale: Locale, n: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB").format(n);
const month = (locale: Locale, ym: string) => formatDate(locale, `${ym}-01`, "long").replace(/^1\.?\s*/, "");

type Status = "on" | "ready" | "off" | "checking" | "planned";

function Source({ locale, title, status, children }: { locale: Locale; title: string; status: Status; children: string }) {
  const label = {
    on: "connectStatusOn",
    ready: "connectStatusReady",
    off: "connectStatusOff",
    checking: "connectStatusChecking",
    planned: "connectStatusPlanned",
  } as const;
  return (
    <li className="cx-source" data-status={status}>
      <div className="cx-source-head">
        <h3>{title}</h3>
        <span className="cx-status" data-status={status}>
          <i aria-hidden="true" />
          {t(locale, label[status])}
        </span>
      </div>
      <p>{children}</p>
    </li>
  );
}

export function ConnectPage({ client, locale }: { client: AeiClient; locale: Locale }) {
  const meta = useProbe<Meta>(() => client.meta());
  const quality = useProbe<QualityResponse>(() => client.quality());
  const regional = useProbe<RegionalResponse>(() => client.regional({}));
  const counties = useProbe(() => client.counties());

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [format, setFormat] = useState<IngestFormat>("hl7v2");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ format: IngestFormat | null; parsed: IngestResult | null } | null>(null);

  const loadSample = async (id: IngestFormat) => {
    setFormat(id);
    setResult(null);
    const f = FORMATS.find((x) => x.id === id);
    if (!f) return;
    try {
      const res = await fetch(`${base}/samples/${f.file}`);
      setText(res.ok ? await res.text() : "");
    } catch {
      setText("");
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the first example loads once
  useEffect(() => {
    void loadSample("hl7v2");
  }, []);

  const check = () => {
    const type = FORMATS.find((x) => x.id === format)?.type ?? "";
    const detected = detectFormat(text, type);
    if (!detected) return setResult({ format: null, parsed: null });
    try {
      setResult({ format: detected, parsed: ingest(text, detected) });
    } catch {
      setResult({ format: null, parsed: null });
    }
  };

  const q = quality.state === "ok" ? quality.data.checked : null;
  const m = meta.state === "ok" ? meta.data : null;
  const r = regional.state === "ok" ? regional.data : null;
  const organisms = result?.parsed ? [...new Set(result.parsed.isolates.map((i) => i.organism))].sort() : [];
  const fmtLabel = FORMATS.find((x) => x.id === result?.format)?.label ?? "";
  const contentType = FORMATS.find((x) => x.id === format)?.type ?? "";

  // Open national sources: listed as connected only when this server answers for them.
  const thl = (
    <Source
      key="thl"
      locale={locale}
      title={t(locale, "connectThlTitle")}
      status={regional.state === "checking" ? "checking" : r ? "on" : "off"}
    >
      {r?.months.length
        ? t(locale, "connectThlBody", {
            from: month(locale, r.months[0] as string),
            to: month(locale, r.months[r.months.length - 1] as string),
            fetched: formatDate(locale, r.fetched),
          })
        : t(locale, "connectThlSource")}
    </Source>
  );
  const geo = (
    <Source
      key="geo"
      locale={locale}
      title={t(locale, "connectGeoTitle")}
      status={counties.state === "checking" ? "checking" : counties.state === "ok" ? "on" : "off"}
    >
      {t(locale, "connectGeoBody")}
    </Source>
  );
  const thlOff = regional.state === "off";
  const geoOff = counties.state === "off";

  return (
    <section className="connect" aria-labelledby="connect-title">
      <header className="cx-head">
        <h1 id="connect-title" className="result-title">
          {t(locale, "connectTitle")}
        </h1>
        <p className="cx-lead">{t(locale, "connectLead")}</p>
        <p className="cx-note">{t(locale, "connectDemoNote")}</p>
      </header>

      <h2 className="cx-h2">{t(locale, "connectNow")}</h2>
      <ul className="cx-grid">
        <Source locale={locale} title={t(locale, "connectLabTitle")} status={meta.state === "checking" ? "checking" : m ? "on" : "off"}>
          {q && m
            ? t(locale, "connectLabBody", {
                cultures: num(locale, q.cultures),
                isolates: num(locale, q.isolates),
                results: num(locale, q.results),
                from: formatDate(locale, m.datasetStart, "long"),
                to: formatDate(locale, m.datasetEnd, "long"),
              })
            : "–"}
        </Source>
        <Source locale={locale} title={t(locale, "connectLisTitle")} status={meta.state === "checking" ? "checking" : m ? "ready" : "off"}>
          {t(locale, "connectLisBody")}
        </Source>
        {thlOff ? null : thl}
        {geoOff ? null : geo}
        <Source locale={locale} title={t(locale, "connectCodesTitle")} status="on">
          {t(locale, "connectCodesBody")}
        </Source>
      </ul>

      <h2 className="cx-h2">{t(locale, "connectNext")}</h2>
      <ul className="cx-grid">
        {thlOff ? thl : null}
        {geoOff ? geo : null}
        <Source locale={locale} title={t(locale, "connectEhrTitle")} status="planned">
          {t(locale, "connectEhrBody")}
        </Source>
        <Source locale={locale} title={t(locale, "connectWhonetTitle")} status="planned">
          {t(locale, "connectWhonetBody")}
        </Source>
      </ul>

      <section className="cx-try" aria-labelledby="cx-try-title">
        <h2 id="cx-try-title" className="cx-h2">
          {t(locale, "connectTryTitle")}
        </h2>
        <p className="cx-lead">{t(locale, "connectTryLead")}</p>
        <div className="choice-row" role="group" aria-label={t(locale, "connectLoadSample")}>
          {FORMATS.map((f) => (
            <button key={f.id} type="button" className="choice" aria-pressed={format === f.id} onClick={() => void loadSample(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="cx-label" htmlFor="cx-message">
          {t(locale, "connectMessage")}
        </label>
        <textarea
          id="cx-message"
          className="cx-message"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
        />
        <button type="button" className="btn btn-primary cx-check" onClick={check} disabled={!text.trim()}>
          {t(locale, "connectCheck")}
        </button>

        {result ? (
          <div className="cx-result" role="status">
            {result.parsed && result.format ? (
              <>
                <p className="cx-result-head">{t(locale, "connectDetected", { format: fmtLabel })}</p>
                <p className="cx-result-counts">
                  {t(locale, "connectParsed", {
                    patients: num(locale, result.parsed.patients.length),
                    cultures: num(locale, result.parsed.cultures.length),
                    isolates: num(locale, result.parsed.isolates.length),
                    results: num(locale, result.parsed.susceptibility.length),
                  })}
                </p>
                {organisms.length ? (
                  <p>
                    <span className="cx-k">{t(locale, "connectOrganisms")}:</span> <i>{organisms.join(", ")}</i>
                  </p>
                ) : null}
                {result.parsed.warnings.length ? (
                  <details>
                    <summary>
                      {t(locale, "connectWarnings")} ({result.parsed.warnings.length})
                    </summary>
                    <ul>
                      {result.parsed.warnings.slice(0, 20).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p>{t(locale, "connectNoWarnings")}</p>
                )}
              </>
            ) : (
              <p>{t(locale, "connectUnknown")}</p>
            )}
          </div>
        ) : null}

        <h3 className="cx-h3">{t(locale, "connectSendTitle")}</h3>
        <p className="cx-lead">{t(locale, "connectSendBody")}</p>
        <pre className="cx-code">
          <code>{`curl -X POST https://<aei-server>/api/ingest \\\n  -H "Content-Type: ${contentType}" \\\n  --data-binary @${FORMATS.find((x) => x.id === format)?.file ?? "report"}`}</code>
        </pre>
      </section>
    </section>
  );
}
