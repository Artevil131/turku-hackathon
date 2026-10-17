import type { AeiClient, Project } from "@aei/contract";
import type { Phenotype } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { useState } from "react";
import { useShell } from "../../shell/context.ts";
import { allSites, currentSite, siteWards } from "../../sites.ts";
import { ProjectDialog } from "../research/projects/ProjectDialog.tsx";
import { TEMPLATE_KEYS, TEMPLATES, type Template, templateJson } from "../research/workspace/templates.ts";

export function NewProjectDialog({
  client,
  locale,
  clock,
  initial,
  onClose,
}: {
  client: AeiClient;
  locale: Locale;
  clock: string | null;
  initial: Template;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState(initial);
  const [name, setName] = useState(t(locale, TEMPLATE_KEYS[initial][0]));
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Project["mode"]>("continuous");
  const [asOf, setAsOf] = useState(clock ?? "");
  const [site, setSite] = useState(currentSite() ?? "");
  const [units, setUnits] = useState<string[]>([]);
  const [phenotypes, setPhenotypes] = useState<Phenotype[]>([]);
  const [from, setFrom] = useState("");
  const shell = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <ProjectDialog title={t(locale, "startNew")} closeLabel={t(locale, "startCancel")} onClose={onClose}>
      <form
        className="start-create"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setFailed(false);
          try {
            const board = new URLSearchParams();
            if (units.length === 1) board.set("unit", units[0] as string);
            if (phenotypes.length === 1) board.set("ph", phenotypes[0] as string);
            const { project } = await client.createProject({
              name,
              description,
              mode,
              ...(mode === "frozen" ? { asOf } : {}),
              scope: {
                site: site || undefined,
                units,
                phenotypes,
                organisms: [],
                kinds: [],
                from: from || undefined,
                board: board.toString(),
              },
              layout: templateJson(template),
            });
            shell.openProject(project);
            onClose();
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="start-template-choice">
          <legend>{t(locale, "startTemplates")}</legend>
          {TEMPLATES.map((item) => (
            <label key={item}>
              <input
                type="radio"
                name="template"
                value={item}
                checked={template === item}
                onChange={() => {
                  setTemplate(item);
                  setName(t(locale, TEMPLATE_KEYS[item][0]));
                }}
              />
              {t(locale, TEMPLATE_KEYS[item][0])}
            </label>
          ))}
        </fieldset>
        <label>
          {t(locale, "startName")}
          <input name="name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t(locale, "startDescription")}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="start-form-row">
          <label>
            {t(locale, "startMode")}
            <select value={mode} onChange={(e) => setMode(e.target.value as Project["mode"])}>
              <option value="continuous">{t(locale, "startContinuous")}</option>
              <option value="frozen" disabled={!clock}>
                {t(locale, "startFrozen")}
              </option>
            </select>
          </label>
          {mode === "frozen" ? (
            <label>
              {t(locale, "startAsOf")}
              <input type="date" required max={clock ?? undefined} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </label>
          ) : null}
        </div>
        <div className="start-form-row">
          <label>
            {t(locale, "startSite")}
            <select
              value={site}
              onChange={(e) => {
                setSite(e.target.value);
                setUnits([]);
              }}
            >
              <option value="">{t(locale, "startAll")}</option>
              {allSites().map((s) => (
                <option key={s.id} value={s.id}>
                  {s[locale]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, "startFrom")}
            <input
              type="date"
              max={mode === "frozen" ? asOf : (clock ?? undefined)}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
        </div>
        <fieldset className="start-checks">
          <legend>{t(locale, "startUnits")}</legend>
          {siteWards(site || null).map((w) => (
            <label key={w.code}>
              <input
                type="checkbox"
                checked={units.includes(w.code)}
                onChange={(e) => setUnits((prev) => (e.target.checked ? [...prev, w.code] : prev.filter((v) => v !== w.code)))}
              />
              {w[locale]}
            </label>
          ))}
        </fieldset>
        <fieldset className="start-checks">
          <legend>{t(locale, "startPhenotypes")}</legend>
          {(["esbl", "cpe", "mrsa", "vre"] as Phenotype[]).map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                checked={phenotypes.includes(p)}
                onChange={(e) => setPhenotypes((prev) => (e.target.checked ? [...prev, p] : prev.filter((v) => v !== p)))}
              />
              {p.toUpperCase()}
            </label>
          ))}
        </fieldset>
        {failed ? <p role="alert">{t(locale, "startError")}</p> : null}
        <footer>
          <button className="start-primary" type="submit" disabled={busy || !name.trim()}>
            {t(locale, busy ? "startCreating" : "startCreate")}
          </button>
        </footer>
      </form>
    </ProjectDialog>
  );
}
