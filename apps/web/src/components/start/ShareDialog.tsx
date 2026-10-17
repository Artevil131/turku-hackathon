import type { Project } from "@aei/contract";
import { type Locale, siteName, t } from "@aei/i18n";
import { useState } from "react";
import { ProjectDialog } from "../research/projects/ProjectDialog.tsx";
import "../research/projects/projects.css";
import "./start.css";

export function projectUrl(project: Project): string {
  const url = new URL(location.href);
  const params = new URLSearchParams(project.scope.board ?? "");
  params.set("project", project.id);
  if (project.scope.site) params.set("hospital", project.scope.site);
  url.hash = `workspace?${params}`;
  return url.href;
}

export function ShareDialog({ project, locale, onClose }: { project: Project; locale: Locale; onClose: () => void }) {
  const [people, setPeople] = useState([
    { id: "team", name: t(locale, "shareTeam"), role: "shareOwner" },
    { id: "artem", name: "Artem S.", role: "shareEditor" },
  ] as { id: string; name: string; role: "shareOwner" | "shareEditor" | "shareViewer" }[]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"shareEditor" | "shareViewer">("shareViewer");
  const [anyone, setAnyone] = useState(false);
  const [copied, setCopied] = useState<"shareCopied" | "shareCopyError" | null>(null);
  const link = projectUrl(project);
  return (
    <ProjectDialog title={t(locale, "shareTitle", { name: project.name })} closeLabel={t(locale, "shareClose")} onClose={onClose}>
      <p className="share-preview">{t(locale, "sharePreview")}</p>
      <ul className="share-people">
        {people.map((person) => (
          <li key={person.id}>
            <span>{person.name}</span>
            <span>{t(locale, person.role)}</span>
          </li>
        ))}
      </ul>
      <form
        className="share-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!email.trim()) return;
          setPeople((list) => [...list, { id: crypto.randomUUID(), name: email.trim(), role }]);
          setEmail("");
        }}
      >
        <label>
          {t(locale, "shareEmail")}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t(locale, "shareRole")}
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="shareViewer">{t(locale, "shareViewer")}</option>
            <option value="shareEditor">{t(locale, "shareEditor")}</option>
          </select>
        </label>
        <button type="submit">{t(locale, "shareAdd")}</button>
      </form>
      <label className="share-link-toggle">
        <input type="checkbox" checked={anyone} onChange={(e) => setAnyone(e.target.checked)} />
        {t(locale, "shareAnyone", { site: project.scope.site ? siteName(locale, project.scope.site) : t(locale, "hospital") })}
      </label>
      <input aria-label={t(locale, "shareCopy")} readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied("shareCopied");
          } catch {
            setCopied("shareCopyError");
          }
        }}
      >
        {t(locale, "shareCopy")}
      </button>
      {copied ? <p role="status">{t(locale, copied)}</p> : null}
    </ProjectDialog>
  );
}
