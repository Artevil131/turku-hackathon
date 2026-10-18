import type { AeiClient, Project } from "@aei/contract";
import { formatDate, type Locale, siteName, t, wardName } from "@aei/i18n";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { DEMOS, type DemoSpec } from "../../demo/demos.ts";
import { useShell } from "../../shell/context.ts";
import { launchTemplate } from "../../shell/launch.ts";
import { DeleteProjectDialog } from "../research/projects/ProjectDialogs.tsx";
import { parseLayout } from "../research/workspace/layout.ts";
import { QUICK_STARTS, TEMPLATE_KEYS, TEMPLATES, type Template } from "../research/workspace/templates.ts";
import { openSearch } from "../shell/Sidebar.tsx";
import type { Audience } from "./audience.ts";
import { MoreQuestions } from "./MoreQuestions.tsx";
import { NewProjectDialog } from "./NewProjectDialog.tsx";
import {
  CHIPS,
  type ChipAction,
  MORE_QUESTIONS,
  ROLE_DEMO,
  ROLE_LABEL,
  ROLES,
  type Role,
  storedRole,
  storeRole,
  TEMPLATE_ORDER,
} from "./roles.ts";
import { ShareDialog } from "./ShareDialog.tsx";
import { TemplateArt } from "./TemplateArt.tsx";
import "../home/home.css";
import "../research/SignalFeed.css";
import "./start.css";
import { hashParams } from "../../url.ts";

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
/** A row of cards you scroll sideways through (swipe, wheel, or the arrows); the scrollbar itself is hidden. */
function ScrollRow({ locale, children }: { locale: Locale; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = row.current;
    if (el) setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const by = (dir: 1 | -1) =>
    row.current?.scrollBy({ left: dir * Math.max(240, (row.current?.clientWidth ?? 0) * 0.8), behavior: "smooth" });
  return (
    <div className="start-scroll" data-left={edge.left || undefined} data-right={edge.right || undefined}>
      <div className="start-project-grid" ref={row} onScroll={measure}>
        {children}
      </div>
      <button
        type="button"
        className="start-scroll-btn"
        data-dir="left"
        aria-label={t(locale, "startScrollLeft")}
        onClick={() => by(-1)}
        tabIndex={edge.left ? 0 : -1}
      >
        ‹
      </button>
      <button
        type="button"
        className="start-scroll-btn"
        data-dir="right"
        aria-label={t(locale, "startScrollRight")}
        onClick={() => by(1)}
        tabIndex={edge.right ? 0 : -1}
      >
        ›
      </button>
    </div>
  );
}
export function StartPage({
  client,
  locale,
  clock,
  audience,
  onDemo,
  onTour,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  audience: Audience;
  onDemo: (demo: DemoSpec) => void;
  onTour: () => void;
}) {
  // The profession chosen on the page decides the order and the example questions; the audience preset is the fallback.
  const [chosen, setChosen] = useState<Role | null>(storedRole);
  const role: Role = chosen ?? audience;
  const pick = (r: Role) => {
    setChosen(r);
    storeRole(r);
  };
  const run = (action: ChipAction) => {
    if (action.kind === "demo") {
      const d = DEMOS.find((x) => x.id === action.id);
      if (d) onDemo(d);
    } else if (action.kind === "template") void launch(action.template);
    else if (action.kind === "view") shell.openView(action.template, action.params);
    else location.hash = action.href.slice(1);
  };
  // "Start empty" from a demo's tour lands here with ?start=<template>: the project opens at once.
  useEffect(() => {
    const wanted = hashParams().get("start");
    if (!wanted || !(TEMPLATES as readonly string[]).includes(wanted)) return;
    history.replaceState(null, "", "#home");
    void launch(wanted as Template);
  }, []);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [more, setMore] = useState(false);
  const [creating, setCreating] = useState<Template | null>(null);
  const [sharing, setSharing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState<Template | null>(null);
  const [actionError, setActionError] = useState(false);
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
  const templates = TEMPLATE_ORDER[role];
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
        <div className="start-role" data-first={chosen === null || undefined} role="group" aria-label={t(locale, "roleAsk")}>
          <span className="start-role-label">{t(locale, "roleAsk")}</span>
          {ROLES.map((r) => (
            <button type="button" key={r} data-role={r} aria-pressed={chosen === r} onClick={() => pick(r)}>
              {t(locale, ROLE_LABEL[r])}
            </button>
          ))}
          {chosen === null ? <span className="start-role-note">{t(locale, "roleAskNote")}</span> : null}
        </div>
        <div className="start-ask" role="search">
          <button type="button" className="start-ask-field" data-start-ask onClick={openSearch}>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <span>{t(locale, "startAskPlaceholder")}</span>
            <kbd>/</kbd>
          </button>
          <div className="start-ask-chips">
            {CHIPS[role].map((c) => (
              <button type="button" key={c.label} onClick={() => run(c.action)}>
                {t(locale, c.label)}
              </button>
            ))}
            <button type="button" className="start-ask-more" data-more-questions onClick={() => setMore(true)}>
              {t(locale, "qMoreOpen")}
            </button>
          </div>
        </div>
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
            // Nothing yet: the demo for this audience, which opens with its guided tour.
            (() => {
              const demo = DEMOS.find((d) => d.id === ROLE_DEMO[role]) ?? DEMOS[0];
              return demo ? (
                <div className="start-empty">
                  <TemplateArt demo={demo.id} />
                  <div>
                    <h3>{t(locale, "demoSuggest")}</h3>
                    <p>{t(locale, "demoSuggestNote", { title: t(locale, demo.titleKey) })}</p>
                    <button type="button" className="start-primary" data-demo={demo.id} onClick={() => onDemo(demo)}>
                      {t(locale, "demoSuggestOpen", { role: t(locale, demo.roleKey) })}
                    </button>
                  </div>
                </div>
              ) : null;
            })()
          ) : (
            <ScrollRow locale={locale}>
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
            </ScrollRow>
          )}
        </section>
        <section id="start-demos" tabIndex={-1}>
          <h2>{t(locale, "demoSection")}</h2>
          <div className="start-demo-grid">
            <button type="button" className="start-demo start-tour" data-tour onClick={onTour}>
              <strong>{t(locale, "tourOvBoxTitle")}</strong>
              <span>{t(locale, "tourOvBoxNote")}</span>
            </button>
            {DEMOS.map((demo) => (
              <button type="button" className="start-demo" key={demo.id} data-demo={demo.id} onClick={() => onDemo(demo)}>
                <TemplateArt demo={demo.id} />
                <strong>{t(locale, demo.roleKey)}</strong>
              </button>
            ))}
          </div>
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
                    <TemplateArt template={template} />
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
      {more ? (
        <MoreQuestions
          locale={locale}
          questions={MORE_QUESTIONS[role]}
          onPick={(action) => {
            setMore(false);
            run(action);
          }}
          onClose={() => setMore(false)}
        />
      ) : null}
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
