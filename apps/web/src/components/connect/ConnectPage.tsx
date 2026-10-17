import type { AeiClient, IngestResponse, Meta, QualityResponse, RegionalResponse } from "@aei/contract";
import { formatDate, type Locale, siteName, t } from "@aei/i18n";
import { detectFormat, type IngestFormat, type IngestResult, ingest } from "@aei/ingest";
import { qualifyResult, registryFromList } from "@aei/sites";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { allSites, allWards, currentSite, homeSite, useSites } from "../../sites.ts";
import { Hospital, Paste, Terminal, Upload } from "../Icons.tsx";
import { ConnectHospital } from "./Hospitals.tsx";
import { IngestMap, SiteCards } from "./IngestMap.tsx";
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

/** `embedded`: a section of the Data page, which carries the page's one h1. */
export function ConnectPage({ client, locale, embedded = false }: { client: AeiClient; locale: Locale; embedded?: boolean }) {
  const Title = embedded ? "h2" : "h1";
  const meta = useProbe<Meta>(() => client.meta());
  const quality = useProbe<QualityResponse>(() => client.quality());
  const regional = useProbe<RegionalResponse>(() => client.regional({}));
  const counties = useProbe(() => client.counties());

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [format, setFormat] = useState<IngestFormat>("hl7v2");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    format: IngestFormat | null;
    parsed: IngestResult | null;
    units?: string[];
    unregistered?: string[];
  } | null>(null);
  // The checker reads a message as the chosen hospital would send it (D-051): its units, qualified.
  const { multi } = useSites();
  const [checkSite, setCheckSite] = useState<string>(() => currentSite() ?? homeSite().id);
  const registry = useMemo(() => registryFromList(allSites(), allWards(), homeSite()), []);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileNote, setFileNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [token, setToken] = useState("");
  type Sent = { state: "sending" } | { state: "done"; status: number; body: IngestResponse; before: string | null } | { state: "offline" };
  const [sent, setSent] = useState<Sent | null>(null);

  const readFile = async (file: File) => {
    try {
      const body = await file.text();
      const detected = detectFormat(body, file.type || (file.name.endsWith(".json") ? "application/json" : ""));
      if (detected) setFormat(detected);
      setText(body);
      setResult(null);
      setSent(null);
      const size = file.size < 1024 ? `${file.size} B` : `${Math.round(file.size / 1024)} kB`;
      setFileNote({ ok: true, text: t(locale, "connectFileLoaded", { name: file.name, size }) });
    } catch {
      setFileNote({ ok: false, text: t(locale, "connectFileError", { name: file.name }) });
    }
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };
  const jump = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  };
  const send = async () => {
    if (!result?.format) return;
    setSent({ state: "sending" });
    try {
      const before = (await client.clock().catch(() => null))?.asOf ?? null;
      const type = FORMATS.find((x) => x.id === result.format)?.type ?? "text/plain";
      const out = await client.ingest(text, type, token.trim() || undefined);
      setSent({ state: "done", status: out.status, body: out.body, before });
    } catch {
      setSent({ state: "offline" });
    }
  };
  const isHome = checkSite === homeSite().id;
  const sendable = !!result?.parsed && !!result.format && result.parsed.cultures.length > 0;

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
    setSent(null);
    const type = FORMATS.find((x) => x.id === format)?.type ?? "";
    const detected = detectFormat(text, type);
    if (!detected) return setResult({ format: null, parsed: null });
    try {
      const from = registry.connection(checkSite);
      if (!from || checkSite === homeSite().id) return setResult({ format: detected, parsed: ingest(text, detected) });
      const { result: parsed, unregistered } = qualifyResult(ingest(text, detected, { maps: from.maps }), from, homeSite().id);
      setResult({
        format: detected,
        parsed,
        units: [...new Set(parsed.cultures.map((c) => c.ward))],
        unregistered: [...new Set(unregistered)],
      });
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

  const checker = (
    <section className="cx-try" aria-labelledby="cx-try-title">
      <h2 id="cx-try-title" className="cx-h2" tabIndex={-1}>
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
      {multi ? (
        <label className="cx-field cx-check-site">
          <span className="cx-label">{t(locale, "connectCheckSite")}</span>
          <select
            className="cx-input"
            value={checkSite}
            onChange={(e) => {
              setCheckSite(e.target.value);
              setResult(null);
            }}
          >
            {allSites().map((s) => (
              <option key={s.id} value={s.id}>
                {siteName(locale, s.id)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <section
        className="cx-drop"
        data-dragging={dragging}
        aria-label={t(locale, "connectDrop")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload />
        <span>{dragging ? t(locale, "connectDropActive") : t(locale, "connectDrop")}</span>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          {t(locale, "connectChoose")}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="visually-hidden"
          tabIndex={-1}
          accept=".hl7,.txt,.json,.csv,.er7,text/plain,text/csv,application/json,application/fhir+json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = "";
          }}
        />
      </section>
      {fileNote ? (
        <p className="cx-feedback" data-ok={fileNote.ok} role="status">
          {fileNote.text}
        </p>
      ) : null}
      <label className="cx-label" htmlFor="cx-message">
        {t(locale, "connectMessage")}
      </label>
      <textarea
        ref={textRef}
        placeholder={t(locale, "connectEmpty")}
        id="cx-message"
        className="cx-message"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
          setSent(null);
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
              {result.units?.length ? <p>{t(locale, "connectCheckUnits", { units: result.units.join(", ") })}</p> : null}
              {result.unregistered?.length ? (
                <p>{t(locale, "connectCheckUnregistered", { units: result.unregistered.join(", ") })}</p>
              ) : null}
              {result.units ? <p className="cx-note">{t(locale, "connectCheckSiteMap")}</p> : null}
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

      {result?.parsed && result.format ? (
        <div className="cx-send">
          {!isHome || multi ? (
            <label className="cx-field">
              <span className="cx-label">{t(locale, "connectToken", { site: siteName(locale, checkSite) })}</span>
              <input
                className="cx-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <span className="cx-note">
                {isHome ? t(locale, "connectTokenHomeHint", { site: siteName(locale, checkSite) }) : t(locale, "connectTokenHint")}
              </span>
            </label>
          ) : null}
          <p className="cx-note">{t(locale, "connectSendAs", { site: siteName(locale, checkSite) })}</p>
          <button
            type="button"
            className="btn btn-primary cx-send-btn"
            onClick={() => void send()}
            disabled={!sendable || sent?.state === "sending"}
          >
            {sent?.state === "sending" ? t(locale, "connectSending") : t(locale, "connectSendAei")}
          </button>
          {!sendable ? <p className="cx-note">{t(locale, "connectSendFirst")}</p> : null}
          {sent?.state === "offline" ? (
            <p className="cx-feedback" data-ok="false" role="status">
              {t(locale, "connectSentOffline")}
            </p>
          ) : null}
          {sent?.state === "done" ? <SendResult locale={locale} sent={sent} /> : null}
        </div>
      ) : null}

      <h3 className="cx-h3">{t(locale, "connectSendTitle")}</h3>
      <p className="cx-lead">{t(locale, "connectSendBody")}</p>
      <pre className="cx-code">
        <code>{`curl -X POST https://<aei-server>/api/ingest \\\n  -H "Content-Type: ${contentType}" \\\n  --data-binary @${FORMATS.find((x) => x.id === format)?.file ?? "report"}`}</code>
      </pre>
    </section>
  );

  return (
    <section className="connect" aria-labelledby="connect-title">
      <header className="cx-head">
        <Title id="connect-title" className="result-title">
          {t(locale, "connectTitle")}
        </Title>
        <p className="cx-lead">{t(locale, "connectLead")}</p>
        <p className="cx-note">{t(locale, "connectDemoNote")}</p>
      </header>

      <nav className="cx-actions" aria-label={t(locale, "connectActions")}>
        <button type="button" className="cx-action" onClick={() => fileRef.current?.click()}>
          <Upload />
          <span>
            <b>{t(locale, "connectActImport")}</b>
            <small>{t(locale, "connectActImportSub")}</small>
          </span>
        </button>
        <button
          type="button"
          className="cx-action"
          onClick={() => {
            jump("cx-try-title");
            textRef.current?.focus();
            textRef.current?.select();
          }}
        >
          <Paste />
          <span>
            <b>{t(locale, "connectActPaste")}</b>
            <small>{t(locale, "connectActPasteSub")}</small>
          </span>
        </button>
        <button type="button" className="cx-action" onClick={() => jump("cx-add-title")}>
          <Hospital />
          <span>
            <b>{t(locale, "connectActConnect")}</b>
            <small>{t(locale, "connectActConnectSub")}</small>
          </span>
        </button>
        <button type="button" className="cx-action" onClick={() => jump("cx-demo-title")}>
          <Terminal />
          <span>
            <b>{t(locale, "connectActDemo")}</b>
            <small>{t(locale, "connectActDemoSub")}</small>
          </span>
        </button>
      </nav>

      <IngestMap client={client} locale={locale} />
      <SiteCards client={client} locale={locale} />

      {checker}

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

      <ConnectHospital locale={locale} site={checkSite} />
    </section>
  );
}

/** The server's answer to a sent message: what it accepted, the alerts it raised, the checks, the clock. */
function SendResult({ locale, sent }: { locale: Locale; sent: { status: number; body: IngestResponse; before: string | null } }) {
  const b = sent.body;
  if (sent.status === 200)
    return (
      <div className="cx-feedback cx-sent" data-ok="true" role="status">
        <p className="cx-result-head">
          {t(locale, "connectSentOk", {
            cultures: num(locale, b.accepted ?? 0),
            isolates: num(locale, b.isolates ?? 0),
            results: num(locale, b.results ?? 0),
            site: siteName(locale, b.site ?? homeSite().id),
          })}
        </p>
        <p>
          {b.newAlerts?.length
            ? t(locale, "connectSentAlerts", { n: b.newAlerts.length, ids: b.newAlerts.slice(0, 5).join(", ") })
            : t(locale, "connectSentNoAlerts")}
        </p>
        <p>
          {b.asOf && sent.before && b.asOf !== sent.before
            ? t(locale, "connectSentClock", { from: formatDate(locale, sent.before), to: formatDate(locale, b.asOf) })
            : b.asOf
              ? t(locale, "connectSentClockSame", { date: formatDate(locale, b.asOf) })
              : null}
        </p>
        <p>{b.quality?.length ? t(locale, "connectSentQuality", { n: b.quality.length }) : t(locale, "connectSentQualityOk")}</p>
        {b.warnings?.length ? (
          <details>
            <summary>
              {t(locale, "connectWarnings")} ({b.warnings.length})
            </summary>
            <ul>
              {b.warnings.slice(0, 20).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    );
  return (
    <div className="cx-feedback" data-ok="false" role="status">
      <p>
        {sent.status === 422
          ? t(locale, "connectSentNothing", { status: sent.status })
          : t(locale, "connectSentRefused", { status: sent.status, error: b.error ?? "" })}
      </p>
      {b.warnings?.length ? (
        <ul>
          {b.warnings.slice(0, 20).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
