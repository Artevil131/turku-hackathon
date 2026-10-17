import type { AeiClient, QualityResponse, SiteStatus, SitesResponse } from "@aei/contract";
import { countyName, formatDate, type Locale, type MessageKey, siteName, t } from "@aei/i18n";
import { useEffect, useState } from "react";
import { useSites } from "../../sites.ts";

// The Connect page's picture of data coming in (D-051): hospitals and lab systems on the left, the three
// formats as lanes into the one ingest route, and the steps a message passes inside AEI, with live counts
// from /api/sites and /api/quality. Drawn with CSS only. Below it, one card per hospital with its counts,
// last message and the last 28 days of isolates. Nothing here claims a connection the server does not have:
// planned sources carry "planned", the dataset's hospital carries "demo".

const num = (locale: Locale, n: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB").format(n);
const FORMAT_LABEL = { hl7v2: "HL7 v2", fhir: "FHIR R4", csv: "CSV" } as const;
const LANES = [
  { id: "hl7v2", label: "HL7 v2", sub: "ORU^R01" },
  { id: "fhir", label: "FHIR R4", sub: "Bundle" },
  { id: "csv", label: "CSV", sub: "WHONET-style" },
] as const;
const dayMs = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);

type Tag = "live" | "demo" | "planned" | "awaiting" | "off";
const TAG_KEY: Record<Tag, MessageKey> = {
  live: "connectMapLive",
  demo: "connectMapDemo",
  planned: "connectMapPlanned",
  awaiting: "connectMapAwaiting",
  off: "connectMapOff",
};

function Tags({ locale, tags }: { locale: Locale; tags: readonly Tag[] }) {
  return (
    <span className="im-tags">
      {tags.map((tag) => (
        <span key={tag} className="im-tag" data-tag={tag}>
          {tag === "live" || tag === "awaiting" || tag === "off" ? <i aria-hidden="true" /> : null}
          {t(locale, TAG_KEY[tag])}
        </span>
      ))}
    </span>
  );
}

function useSitesData(client: AeiClient) {
  const [sites, setSites] = useState<SitesResponse | null>(null);
  const [findings, setFindings] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    client.sites().then(
      async (d) => {
        if (!live) return;
        setSites(d);
        // The checks of every hospital's rows, added up (each hospital's are its own, D-051).
        const all = await Promise.all(d.sites.map((s) => client.quality({ site: s.id }).catch(() => null)));
        const n = all.reduce((sum, q: QualityResponse | null) => sum + (q ? q.summary.reduce((a, c) => a + c.count, 0) : 0), 0);
        if (live) setFindings(n);
      },
      () => live && setSites(null),
    );
    return () => {
      live = false;
    };
  }, [client]);
  return { sites, findings };
}

const tagsOf = (s: SiteStatus): Tag[] => (s.status === "home" ? ["live", "demo"] : s.status === "connected" ? ["live"] : ["awaiting"]);

export function IngestMap({ client, locale }: { client: AeiClient; locale: Locale }) {
  const { sites, findings } = useSitesData(client);
  const list = sites?.sites ?? [];
  const total = (f: (s: SiteStatus) => number) => list.reduce((a, s) => a + f(s), 0);
  const used = new Set(list.map((s) => (s.status === "home" ? "hl7v2" : s.feed.lastFormat)).filter(Boolean));
  const messages = total((s) => s.feed.messages);
  const refused = total((s) => s.feed.rejected);
  const unregistered = total((s) => s.feed.unregistered);

  const steps: { key: MessageKey; detail: string | null; tags: Tag[] }[] = [
    {
      key: "connectMapStepFormat",
      detail: sites
        ? [t(locale, "connectMapMessages", { n: num(locale, messages) }), refused ? t(locale, "connectMapRefused", { n: refused }) : null]
            .filter(Boolean)
            .join(" · ")
        : null,
      tags: ["live"],
    },
    {
      key: "connectMapStepCodes",
      detail: unregistered ? t(locale, "connectMapUnregistered", { n: num(locale, unregistered) }) : null,
      tags: ["live"],
    },
    {
      key: "connectMapStepChecks",
      detail:
        findings === null
          ? null
          : findings
            ? t(locale, "connectMapChecksN", { n: num(locale, findings) })
            : t(locale, "connectMapChecksOk"),
      tags: ["live"],
    },
    {
      key: "connectMapStepStored",
      detail: sites
        ? t(locale, "connectMapHeld", {
            cultures: num(
              locale,
              total((s) => s.counts.cultures),
            ),
            sites: list.length,
          })
        : null,
      tags: ["live"],
    },
    { key: "connectMapStepPushed", detail: null, tags: ["live"] },
  ];

  return (
    <section className="im" aria-labelledby="im-title">
      <h2 id="im-title" className="cx-h2">
        {t(locale, "connectMapTitle")}
      </h2>
      <p className="cx-lead">{t(locale, "connectMapLead")}</p>
      <div className="im-map">
        <div className="im-col im-sources">
          <h3 className="im-col-title">{t(locale, "connectMapSources")}</h3>
          <ul>
            {list.map((s) => (
              <li key={s.id} className="im-node" data-status={s.status}>
                <span className="im-node-name">{siteName(locale, s.id)}</span>
                <span className="im-node-sub">
                  {countyName(locale, s.county)}
                  {s.feed.lastFormat ? ` · ${FORMAT_LABEL[s.feed.lastFormat]}` : ""}
                </span>
                <Tags locale={locale} tags={tagsOf(s)} />
              </li>
            ))}
            {(["connectMapLab", "connectMapFinres", "connectMapAdt"] as const).map((key) => (
              <li key={key} className="im-node" data-status="planned">
                <span className="im-node-name">{t(locale, key)}</span>
                <Tags locale={locale} tags={["planned"]} />
              </li>
            ))}
          </ul>
        </div>
        <div className="im-col im-lanes">
          <h3 className="im-col-title">{t(locale, "connectMapLanes")}</h3>
          <ul>
            {LANES.map((l) => (
              <li key={l.id} className="im-lane" data-used={used.has(l.id)}>
                <b>{l.label}</b>
                <span>{l.sub}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="im-col im-aei">
          <h3 className="im-col-title">{t(locale, "connectMapAei")}</h3>
          <p className="im-route">
            <code>POST /api/ingest</code>
            <span>{t(locale, "connectMapRoute")}</span>
          </p>
          <ol className="im-steps">
            {steps.map((s) => (
              <li key={s.key} className="im-step">
                <span className="im-step-name">{t(locale, s.key)}</span>
                {s.detail ? <span className="im-step-detail num">{s.detail}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Isolates per day over the 28 days up to the clock, as a small bar strip. */
function Spark({ counts, label }: { counts: number[]; label: string }) {
  const max = Math.max(1, ...counts);
  const w = 3;
  const gap = 1;
  const h = 24;
  return (
    <svg className="im-spark" viewBox={`0 0 ${counts.length * (w + gap)} ${h}`} role="img" aria-label={label} preserveAspectRatio="none">
      {counts.map((n, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one bar per day, in order
        <rect key={i} x={i * (w + gap)} y={h - (n / max) * h} width={w} height={(n / max) * h} />
      ))}
    </svg>
  );
}

export function SiteCards({ client, locale }: { client: AeiClient; locale: Locale }) {
  const { site } = useSites();
  const [data, setData] = useState<{ sites: SitesResponse; days: Record<string, number[]> } | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const sites = await client.sites();
        const from = addDays(sites.asOf, -27);
        const days: Record<string, number[]> = {};
        await Promise.all(
          sites.sites.map(async (s) => {
            const { records } = await client.isolates({ from, site: s.id });
            const counts = Array.from({ length: 28 }, () => 0);
            for (const r of records) {
              const i = Math.round((Date.parse(`${r.sampleDate}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs);
              if (i >= 0 && i < 28) counts[i] = (counts[i] ?? 0) + 1;
            }
            days[s.id] = counts;
          }),
        );
        if (live) setData({ sites, days });
      } catch {
        if (live) setData(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [client]);
  if (!data) return null;
  const asOf = data.sites.asOf;
  // The selected hospital first.
  const list = [...data.sites.sites].sort((a, b) => Number(b.id === site) - Number(a.id === site));
  return (
    <section aria-labelledby="im-cards-title">
      <h2 id="im-cards-title" className="cx-h2">
        {t(locale, "connectCardsTitle")}
      </h2>
      <ul className="cx-grid im-cards">
        {list.map((s) => {
          const f = s.feed;
          const name = siteName(locale, s.id);
          return (
            <li key={s.id} className="cx-source im-card" data-current={s.id === site}>
              <div className="cx-source-head">
                <h3>
                  {name} <span className="cx-site-id">{s.id}</span>
                </h3>
                <Tags locale={locale} tags={tagsOf(s)} />
              </div>
              <p className="cx-site-county">{countyName(locale, s.county)}</p>
              <dl className="im-facts">
                <div>
                  <dt>{t(locale, "connectCardUnits")}</dt>
                  <dd className="num">{s.wards.length}</dd>
                </div>
                <div>
                  <dt>{t(locale, "connectCardCultures")}</dt>
                  <dd className="num">{num(locale, s.counts.cultures)}</dd>
                </div>
                <div>
                  <dt>{t(locale, "connectCardIsolates")}</dt>
                  <dd className="num">{num(locale, s.counts.isolates)}</dd>
                </div>
                <div>
                  <dt>{t(locale, "connectCardPatients")}</dt>
                  <dd className="num">{num(locale, s.counts.patients)}</dd>
                </div>
                <div>
                  <dt>{t(locale, "connectCardLast")}</dt>
                  <dd>
                    {f.lastAt
                      ? `${new Date(f.lastAt).toLocaleString(locale === "fi" ? "fi-FI" : "en-GB")}${f.lastFormat ? ` · ${FORMAT_LABEL[f.lastFormat]}` : ""}`
                      : t(locale, "connectCardNone")}
                  </dd>
                </div>
                <div>
                  <dt>{t(locale, "connectCardWarnings")}</dt>
                  <dd className="num" data-warn={f.warnings + f.unregistered + f.rejected > 0}>
                    {f.warnings + f.unregistered + f.rejected
                      ? t(locale, "connectSiteIssues", { warnings: f.warnings, unregistered: f.unregistered, rejected: f.rejected })
                      : t(locale, "connectCardNone")}
                  </dd>
                </div>
              </dl>
              <figure className="im-spark-fig">
                <Spark counts={data.days[s.id] ?? []} label={t(locale, "connectCardSpark", { date: formatDate(locale, asOf) })} />
                <figcaption>{t(locale, "connectCardSpark", { date: formatDate(locale, asOf) })}</figcaption>
              </figure>
              <p>{s.status === "home" ? t(locale, "connectCardHomeSees") : t(locale, "connectCardSees", { site: name })}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
