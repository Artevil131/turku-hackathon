import type { AeiClient, Project } from "@aei/contract";
import type { Phenotype } from "@aei/domain";
import { type Locale, t } from "@aei/i18n";
import { useState } from "react";
import { allSites, siteWards } from "../../sites.ts";
import { ProjectDialog } from "../research/projects/ProjectDialog.tsx";

/**
 * The same details the "Customise" dialog asks for when a project is made, for a project that exists: name, description,
 * hospital, units, phenotypes and the first date. A frozen version keeps its cut: only its name and description change.
 */
export function EditProjectDialog({
  client,
  locale,
  project,
  onSaved,
  onClose,
}: {
  client: AeiClient;
  locale: Locale;
  project: Project;
  onSaved: (project: Project) => void;
  onClose: () => void;
}) {
  const frozen = project.mode === "frozen";
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [site, setSite] = useState<string>(project.scope.site ?? "");
  const [units, setUnits] = useState<string[]>([...project.scope.units]);
  const [phenotypes, setPhenotypes] = useState<Phenotype[]>([...project.scope.phenotypes]);
  const [from, setFrom] = useState(project.scope.from ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <ProjectDialog title={t(locale, "pmSettingsTitle", { name: project.name })} closeLabel={t(locale, "projectClose")} onClose={onClose}>
      <form
        className="start-create"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !name.trim()) return;
          setBusy(true);
          setFailed(false);
          try {
            // Read just before replacing, so the layout saved meanwhile is kept.
            const fresh = (await client.project(project.id)).project;
            const board = new URLSearchParams(fresh.scope.board ?? "");
            if (!frozen) {
              if (units.length === 1) board.set("unit", units[0] as string);
              else board.delete("unit");
              if (phenotypes.length === 1) board.set("ph", phenotypes[0] as string);
              else board.delete("ph");
            }
            const next: Project = {
              ...fresh,
              name: name.trim(),
              description,
              ...(frozen
                ? {}
                : {
                    scope: {
                      ...fresh.scope,
                      site: (site || undefined) as Project["scope"]["site"],
                      units: units as Project["scope"]["units"],
                      phenotypes,
                      from: from || undefined,
                      board: board.toString(),
                    },
                  }),
            };
            const result = await client.updateProject(project.id, next);
            onSaved(result.project);
            onClose();
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t(locale, "startName")}
          {/* biome-ignore lint/a11y/noAutofocus: the dialog exists to edit the project */}
          <input required autoFocus maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t(locale, "startDescription")}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {frozen ? (
          <p className="project-note">{t(locale, "pmSettingsFrozen", { date: project.asOf ?? "" })}</p>
        ) : (
          <>
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
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
            </div>
            <fieldset className="start-checks">
              <legend>{t(locale, "startUnits")}</legend>
              {siteWards((site || null) as never).map((w) => (
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
          </>
        )}
        {failed ? <p role="alert">{t(locale, "pmError")}</p> : null}
        <footer>
          <button className="start-primary" type="submit" disabled={busy || !name.trim()}>
            {t(locale, busy ? "pmBusy" : "pmSave")}
          </button>
        </footer>
      </form>
    </ProjectDialog>
  );
}
