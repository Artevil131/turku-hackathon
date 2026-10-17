import type { AeiClient, Alert, Project } from "@aei/contract";
import { formatDate, type Locale, siteName, t, wardName } from "@aei/i18n";
import { useEffect, useMemo, useState } from "react";
import type { Connection, Finding } from "../../live.ts";
import { useShell } from "../../shell/context.ts";
import { launchTemplate } from "../../shell/launch.ts";
import { sharedQuery } from "../../url.ts";
import { changesOn, incidentOf } from "../home/changes.ts";
import { latestSentence, latestSignal } from "../home/Latest.tsx";
import { Since } from "../home/Since.tsx";
import { IncidentRow } from "../research/feed/IncidentRow.tsx";
import { groupIncidents, openIncidents } from "../research/feed/model.ts";
import { DeleteProjectDialog } from "../research/projects/ProjectDialogs.tsx";
import { parseLayout } from "../research/workspace/layout.ts";
import { QUICK_STARTS, TEMPLATE_KEYS, type Template } from "../research/workspace/templates.ts";
import type { Audience } from "./audience.ts";
import { NewProjectDialog } from "./NewProjectDialog.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
import "../home/home.css";
import "../research/SignalFeed.css";
import "./start.css";

const ORDER: Record<Audience, Template[]> = {
  clinician: ["patient", "antibiogram", "outbreak", "regional", "blank"],
  control: ["outbreak", "antibiogram", "patient", "regional", "blank"],
  researcher: ["blank", "regional", "outbreak", "antibiogram", "patient"],
};
function ago(locale: Locale, date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  return minutes < 1
    ? t(locale, "startNow")
    : minutes < 60
      ? t(locale, "startMinutes", { n: minutes })
      : minutes < 1440
        ? t(locale, "startHours", { n: Math.floor(minutes / 60) })
        : t(locale, "startDays", { n: Math.floor(minutes / 1440) });
}
function LayoutPreview({ layout }: { layout?: Record<string, unknown> }) {
  const parsed = layout ? parseLayout(JSON.stringify(layout)) : null;
  const open = parsed ? Object.entries(parsed.wins).filter(([, win]) => win.open) : [];
  const rows = Math.max(1, ...open.map(([, win]) => win.y + win.h));
  return (
    <div className="start-layout" aria-hidden="true" style={{ position: "relative" }}>
      {open.map(([id, win]) => (
        <span
          key={id}
          style={{
            position: "absolute",
            left: `${(win.x / 12) * 100}%`,
            width: `${(win.w / 12) * 100}%`,
            top: `${(win.y / rows) * 100}%`,
            height: `${(win.h / rows) * 100}%`,
          }}
        >
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
}
export function StartPage({
  client,
  locale,
  clock,
  alerts,
  findings = [],
  connection = "open",
  audience,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  alerts: readonly Alert[];
  findings?: Finding[];
  connection?: Connection;
  audience: Audience;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState<Template | null>(null);
  const [sharing, setSharing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState<Template | null>(null);
  const [actionError, setActionError] = useState(false);
  const [period, setPeriod] = useState<1 | 7 | 28>(1);
  const shell = useShell();
  // A template opens at once, with the defaults; "Customise…" asks for the details first.
  const launch = async (template: Template) => {
    if (QUICK_STARTS.includes(template)) {
      shell.openView(template);
      return;
    }
    if (launching) return;
    setLaunching(template);
    setActionError(false);
    try {
      shell.openProject(await launchTemplate(client, locale, template));
    } catch {
      setActionError(true);
      setLaunching(null);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision reloads after project actions and retry.
  useEffect(() => {
    let stale = false;
    setFailed(false);
    client
      .projects()
      .then((r) => {
        if (!stale) setProjects(r.projects);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [client, revision]);
  const latest = clock ? latestSignal(clock, [...alerts]) : null;
  const changes = useMemo(
    () => (clock ? changesOn(clock, findings, [...alerts], undefined, period) : null),
    [clock, findings, alerts, period],
  );
  const open = useMemo(() => (clock ? openIncidents(groupIncidents(alerts.filter((a) => a.date <= clock)), clock) : []), [clock, alerts]);
  const summary = connection === "offline" ? "offline" : clock === null ? "connecting" : "ready";
  const templates = ORDER[audience];
  return (
    <div className="start-page">
      <div className="start-main">
        <header className="start-heading">
          <div className="start-heading-row">
            <h1>{t(locale, "startHeading")}</h1>
            <div className="start-actions">
              <button type="button" className="start-primary" data-start-new disabled={!!launching} onClick={() => void launch("blank")}>
                {t(locale, launching === "blank" ? "startLaunching" : "startNew")}
              </button>
              <button
                type="button"
                className="start-secondary"
                data-start-customise
                onClick={() => setCreating(templates[0] ?? "blank")}
                title={t(locale, "startCustomiseHint")}
              >
                {t(locale, "startCustomise")}
              </button>
            </div>
          </div>
        </header>
        <section id="start-recent" tabIndex={-1}>
          <h2>{t(locale, "startRecent")}</h2>
          {failed ? (
            <p role="alert">
              {t(locale, "startLoadError")}{" "}
              <button type="button" onClick={() => setRevision((n) => n + 1)}>
                {t(locale, "startRetry")}
              </button>
            </p>
          ) : projects === null ? (
            <div aria-busy="true" className="start-loading" />
          ) : projects.length === 0 ? (
            <div className="start-empty">
              <h3>{t(locale, "startEmpty")}</h3>
              <p>{t(locale, "startEmptyNote")}</p>
              <button type="button" className="start-primary" disabled={!!launching} onClick={() => void launch(templates[0] ?? "blank")}>
                {t(locale, TEMPLATE_KEYS[templates[0] ?? "blank"][0])}
              </button>
            </div>
          ) : (
            <div className="start-project-grid">
              {projects.map((project) => (
                <article className="start-card" key={project.id} data-project-card={project.id}>
                  <button type="button" className="start-card-open" onClick={() => shell.openProject(project)}>
                    <LayoutPreview layout={project.layout} />
                    <h3>{project.name}</h3>
                  </button>
                  <div className="start-card-meta">
                    <span className="start-mode">
                      {t(locale, project.mode === "frozen" ? "startFrozen" : "startContinuous")}
                      {project.asOf ? ` · ${formatDate(locale, project.asOf, "long")}` : clock ? ` · ${formatDate(locale, clock)}` : ""}
                    </span>
                    <div className="start-scope">
                      {project.scope.site ? <span>{siteName(locale, project.scope.site)}</span> : null}
                      {project.scope.units.map((unit) => (
                        <span key={unit}>{wardName(locale, unit)}</span>
                      ))}
                      {project.scope.phenotypes.map((p) => (
                        <span key={p}>{p.toUpperCase()}</span>
                      ))}
                    </div>
                    <time dateTime={project.updatedAt}>{t(locale, "startUpdated", { time: ago(locale, project.updatedAt) })}</time>
                  </div>
                  <details className="start-card-menu">
                    <summary aria-label={t(locale, "startMenu", { name: project.name })}>
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                        <circle cx="4" cy="9" r="1" />
                        <circle cx="9" cy="9" r="1" />
                        <circle cx="14" cy="9" r="1" />
                      </svg>
                    </summary>
                    <div>
                      <button type="button" onClick={() => shell.openProject(project)}>
                        {t(locale, "startOpen")}
                      </button>
                      <button type="button" onClick={() => setSharing(project)}>
                        {t(locale, "startShare")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setActionError(false);
                          try {
                            await client.createProject({
                              ...project,
                              name: t(locale, "startCopyName", { name: project.name }).slice(0, 200),
                            });
                            setRevision((n) => n + 1);
                          } catch {
                            setActionError(true);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t(locale, "startDuplicate")}
                      </button>
                      <button type="button" onClick={() => setDeleting(project)}>
                        {t(locale, "startDelete")}
                      </button>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>
        <section id="start-templates" tabIndex={-1}>
          <h2>{t(locale, "startTemplates")}</h2>
          <div className="start-templates">
            {templates.map((template, i) => {
              const quick = QUICK_STARTS.includes(template);
              return (
                <div
                  key={template}
                  className={`start-template${i === 0 ? " start-template-prominent" : ""}`}
                  data-busy={launching === template || undefined}
                >
                  <button type="button" data-template={template} disabled={!!launching} onClick={() => void launch(template)}>
                    <strong>{t(locale, launching === template ? "startLaunching" : TEMPLATE_KEYS[template][0])}</strong>
                    <span>{t(locale, TEMPLATE_KEYS[template][1])}</span>
                    {quick ? <small>{t(locale, "startQuickNote")}</small> : null}
                  </button>
                  <button
                    type="button"
                    className="start-template-custom"
                    data-customise={template}
                    aria-label={`${t(locale, "startCustomise")} ${t(locale, TEMPLATE_KEYS[template][0])}`}
                    title={t(locale, "startCustomiseHint")}
                    onClick={() => setCreating(template)}
                  >
                    {t(locale, "startCustomise")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        <section id="start-shared" tabIndex={-1}>
          <h2>{t(locale, "startShared")}</h2>
          <div className="start-examples">
            {(["startExampleTeam", "startExampleStudy"] as const).map((key) => (
              <article key={key}>
                <h3>{t(locale, key)}</h3>
                <p>{t(locale, "startExample")}</p>
              </article>
            ))}
          </div>
        </section>
        {actionError ? <p role="alert">{t(locale, "startError")}</p> : null}
      </div>
      <aside className="start-context">
        <p>{t(locale, "startIntro")}</p>
        <Since
          locale={locale}
          asOf={clock}
          changes={changes}
          state={summary}
          period={period}
          onPeriod={setPeriod}
          openCount={summary === "ready" ? open.length : null}
          level={2}
        />
        {summary === "ready" && open.length ? (
          <section className="hm-incidents" aria-label={t(locale, "feedOpen", { n: open.length })}>
            <ul className="feed-list">
              {open.map((incident) => (
                <li key={incident.key}>
                  <IncidentRow
                    locale={locale}
                    incident={incident}
                    spans={null}
                    selected={false}
                    onSelect={(key) => shell.openView(null, { inc: key })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h2>{t(locale, "startLatest")}</h2>
          {latest ? (
            <>
              <time dateTime={latest.date}>{formatDate(locale, latest.date, "long")}</time>
              <p>{latestSentence(locale, latest)}</p>
              <a href={`#project?inc=${encodeURIComponent(incidentOf(latest))}${sharedQuery().replace("?", "&")}`}>
                {t(locale, "startSignalLink")}
              </a>
            </>
          ) : (
            <p>{t(locale, "startNoSignal")}</p>
          )}
        </section>
      </aside>
      {creating ? (
        <NewProjectDialog client={client} locale={locale} clock={clock} initial={creating} onClose={() => setCreating(null)} />
      ) : null}
      {sharing ? <ShareDialog project={sharing} locale={locale} onClose={() => setSharing(null)} /> : null}
      {deleting ? (
        <DeleteProjectDialog
          client={client}
          locale={locale}
          project={deleting}
          onDeleted={(gone) => {
            shell.closeProject(gone.id);
            setRevision((n) => n + 1);
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
