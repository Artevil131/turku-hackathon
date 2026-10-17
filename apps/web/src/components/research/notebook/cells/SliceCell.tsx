import { ORGANISMS, PHENOTYPES, type Phenotype, SPECIMENS } from "@aei/domain";
import { type Locale, phenotypeName, siteName, specimenName, t, wardName } from "@aei/i18n";
import { useState } from "react";
import { allSites, siteWards } from "../../../../sites.ts";
import type { Slice } from "../../tools/model.ts";
import { sliceSentence } from "../../tools/ToolsWindow.tsx";

// A slice cell: the slice as one sentence, Edit for its fields, and two ways to take it from the board.

export interface SliceSources {
  /** The range dragged on the timeline (the hash's from/to), or null. */
  timeline: { from: string; to: string } | null;
  /** The selected signal's window, unit and phenotype, or null. */
  signal: { from: string; to: string; unit?: string; phenotype?: Phenotype | ""; organism?: string } | null;
  /** The hospital the board shows: a new slice's hospital. */
  site?: Slice["site"];
}

/** "Tyks · Urology · E. coli · … · first isolates": the slice sentence with its hospital first. */
export function notebookSliceSentence(locale: Locale, s: Slice): string {
  return s.site ? `${siteName(locale, s.site)} · ${sliceSentence(locale, s)}` : sliceSentence(locale, s);
}

export function SliceCellBody({
  id,
  locale,
  slice,
  sources,
  onChange,
}: {
  id: string;
  locale: Locale;
  slice: Slice;
  sources: SliceSources;
  onChange: (s: Slice) => void;
}) {
  const [editing, setEditing] = useState(false);
  const wards = siteWards(slice.site ?? null).map((w) => w.code as string);
  const sites = allSites();
  const set = <K extends keyof Slice>(key: K, v: Slice[K]) => onChange({ ...slice, [key]: v });
  const { timeline, signal } = sources;
  const bad = slice.from > slice.to;
  const date = (key: "from" | "to", label: string) => (
    <label className="tl-field" htmlFor={`${id}-${key}`}>
      <span>{label}</span>
      <input id={`${id}-${key}`} type="date" value={slice[key]} onChange={(e) => e.target.value && set(key, e.target.value)} />
    </label>
  );
  return (
    <div className="nb-slice">
      <p className="nb-sentence">{notebookSliceSentence(locale, slice)}</p>
      <div className="nb-actions">
        <button type="button" className="btn" aria-expanded={editing} aria-controls={`${id}-fields`} onClick={() => setEditing((e) => !e)}>
          {t(locale, editing ? "nbDone" : "nbEdit")}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!timeline}
          title={timeline ? undefined : t(locale, "nbNoTimeline")}
          onClick={() => timeline && onChange({ ...slice, from: timeline.from, to: timeline.to })}
        >
          {t(locale, "nbUseTimeline")}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!signal}
          title={signal ? undefined : t(locale, "nbNoSignal")}
          onClick={() =>
            signal &&
            onChange({
              ...slice,
              from: signal.from,
              to: signal.to,
              unit: signal.unit ?? slice.unit,
              phenotype: signal.phenotype ?? slice.phenotype,
              organism: signal.organism ?? slice.organism,
            })
          }
        >
          {t(locale, "nbUseSignal")}
        </button>
      </div>
      {bad && <p className="tl-warn">{t(locale, "toolsBadFrame")}</p>}
      {editing && (
        <div id={`${id}-fields`} className="nb-fields">
          <div className="tl-fields">
            {date("from", t(locale, "toolsFrom"))}
            {date("to", t(locale, "toolsTo"))}
          </div>
          <div className="tl-fields">
            <label className="tl-field" htmlFor={`${id}-site`}>
              <span>{t(locale, "nbHospital")}</span>
              <select
                id={`${id}-site`}
                value={slice.site ?? ""}
                onChange={(e) => {
                  const site = e.target.value as NonNullable<Slice["site"]>;
                  // A unit of the other hospital does not exist in this one: the slice goes back to every unit.
                  const keep = siteWards(site).some((w) => w.code === slice.unit);
                  onChange({ ...slice, site, unit: keep ? slice.unit : "" });
                }}
              >
                {sites.map((x) => (
                  <option key={x.id} value={x.id}>
                    {siteName(locale, x.id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tl-field" htmlFor={`${id}-unit`}>
              <span>{t(locale, "toolsUnit")}</span>
              <select id={`${id}-unit`} value={slice.unit} onChange={(e) => set("unit", e.target.value)}>
                <option value="">{t(locale, "toolsUnitAll")}</option>
                {wards.map((w) => (
                  <option key={w} value={w}>
                    {wardName(locale, w as never)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tl-field" htmlFor={`${id}-organism`}>
              <span>{t(locale, "toolsOrganism")}</span>
              <select id={`${id}-organism`} value={slice.organism} onChange={(e) => set("organism", e.target.value)}>
                <option value="">{t(locale, "toolsOrganismAll")}</option>
                {ORGANISMS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="tl-field" htmlFor={`${id}-specimen`}>
              <span>{t(locale, "toolsSpecimen")}</span>
              <select id={`${id}-specimen`} value={slice.specimen} onChange={(e) => set("specimen", e.target.value)}>
                <option value="">{t(locale, "toolsSpecimenAll")}</option>
                {SPECIMENS.map((sp) => (
                  <option key={sp.code} value={sp.code}>
                    {specimenName(locale, sp.code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tl-field" htmlFor={`${id}-phenotype`}>
              <span>{t(locale, "toolsPhenotype")}</span>
              <select id={`${id}-phenotype`} value={slice.phenotype} onChange={(e) => set("phenotype", e.target.value as Phenotype | "")}>
                <option value="">{t(locale, "toolsPhenotypeNone")}</option>
                {PHENOTYPES.map((p) => (
                  <option key={p} value={p}>
                    {phenotypeName(p)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="tl-check">
            <input type="checkbox" checked={slice.firstOnly} onChange={(e) => set("firstOnly", e.target.checked)} />
            <span>{t(locale, "toolsFirstOnly")}</span>
          </label>
        </div>
      )}
    </div>
  );
}
