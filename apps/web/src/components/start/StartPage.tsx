import type { AeiClient, Alert, Project } from "@aei/contract";
import { formatDate, type Locale, siteName, t, wardName } from "@aei/i18n";
import { useEffect, useState } from "react";
import { sharedQuery } from "../../url.ts";
import { incidentOf } from "../home/changes.ts";
import { latestSentence, latestSignal } from "../home/Latest.tsx";
import { ProjectDialog } from "../research/projects/ProjectDialog.tsx";
import { openProject } from "../research/projects/useProject.ts";
import { parseLayout } from "../research/workspace/layout.ts";
import { TEMPLATE_KEYS, type Template } from "../research/workspace/templates.ts";
import { AUDIENCE_KEYS, AUDIENCES, type Audience } from "./audience.ts";
import { NewProjectDialog } from "./NewProjectDialog.tsx";
import { ShareDialog } from "./ShareDialog.tsx";
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
  const columns = parsed?.columns ?? [];
  return (
    <div className="start-layout" aria-hidden="true">
      {columns
        .filter((col) => !parsed?.maximized || col.windows.some((win) => win.id === parsed.maximized))
        .map((col) => {
          const windows = col.windows.filter((win) => !parsed?.maximized || win.id === parsed.maximized);
          return (
            <div key={col.id} style={{ flexGrow: col.width }}>
              {windows.map((win) => (
                <span key={win.id} style={{ flexGrow: win.size }}>
                  <i />
                  <i />
                  <i />
                </span>
              ))}
            </div>
          );
        })}
    </div>
  );
}
export function StartPage({
  client,
  locale,
  clock,
  alerts,
  audience,
  onAudience,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  alerts: readonly Alert[];
  audience: Audience;
  onAudience: (value: Audience) => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState<Template | null>(null);
  const [sharing, setSharing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
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
  const templates = ORDER[audience];
  return (
    <div className="start-page">
      <aside className="start-rail">
        <button type="button" className="start-primary" onClick={() => setCreating(templates[0] ?? "blank")}>
          {t(locale, "startNew")}
        </button>
        <button type="button" disabled>
          {t(locale, "startPackage")} <small>{t(locale, "startSoon")}</small>
        </button>
        <nav aria-label={t(locale, "startProjects")}>
          {(["Recent", "Shared", "Templates"] as const).map((section) => (
            <a
              key={section}
              href={`#start-${section.toLowerCase()}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`start-${section.toLowerCase()}`)?.scrollIntoView({ behavior: "instant" });
                document.getElementById(`start-${section.toLowerCase()}`)?.focus();
              }}
            >
              {t(locale, `start${section}`)}
            </a>
          ))}
        </nav>
      </aside>
      <div className="start-main">
        <header className="start-heading">
          <h1>{t(locale, "startHeading")}</h1>
          <fieldset className="start-audience">
            <legend>{t(locale, "startAs")}</legend>
            {AUDIENCES.map((item) => (
              <label key={item}>
                <input type="radio" name="audience" value={item} checked={audience === item} onChange={() => onAudience(item)} />
                <span>{t(locale, AUDIENCE_KEYS[item])}</span>
              </label>
            ))}
          </fieldset>
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
            <div aria-busy="true" />
          ) : projects.length === 0 ? (
            <div className="start-empty">
              <h3>{t(locale, "startEmpty")}</h3>
              <p>{t(locale, "startEmptyNote")}</p>
              <button type="button" className="start-primary" onClick={() => setCreating(templates[0] ?? "blank")}>
                {t(locale, TEMPLATE_KEYS[templates[0] ?? "blank"][0])}
              </button>
            </div>
          ) : (
            <div className="start-project-grid">
              {projects.map((project) => (
                <article className="start-card" key={project.id} data-project-card={project.id}>
                  <button type="button" className="start-card-open" onClick={() => openProject(project)}>
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
                      <button type="button" onClick={() => openProject(project)}>
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
            {templates.map((template, i) => (
              <button
                key={template}
                type="button"
                data-template={template}
                className={i === 0 ? "start-template-prominent" : undefined}
                onClick={() => setCreating(template)}
              >
                <strong>{t(locale, TEMPLATE_KEYS[template][0])}</strong>
                <span>{t(locale, TEMPLATE_KEYS[template][1])}</span>
              </button>
            ))}
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
        <section>
          <h2>{t(locale, "startLatest")}</h2>
          {latest ? (
            <>
              <time dateTime={latest.date}>{formatDate(locale, latest.date, "long")}</time>
              <p>{latestSentence(locale, latest)}</p>
              <a href={`#workspace?inc=${encodeURIComponent(incidentOf(latest))}${sharedQuery().replace("?", "&")}`}>
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
        <ProjectDialog
          title={t(locale, "startDeleteTitle", { name: deleting.name })}
          closeLabel={t(locale, "startCancel")}
          onClose={() => setDeleting(null)}
        >
          <p>{t(locale, "startDeleteNote")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await client.deleteProject(deleting.id);
                setDeleting(null);
                setRevision((n) => n + 1);
              } catch {
                setActionError(true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(locale, "startDelete")}
          </button>
          {actionError ? <p role="alert">{t(locale, "startError")}</p> : null}
        </ProjectDialog>
      ) : null}
    </div>
  );
}
