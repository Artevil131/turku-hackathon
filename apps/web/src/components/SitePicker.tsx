import { type Locale, siteName, t } from "@aei/i18n";
import { useId } from "react";
import { ALL_SITES, useSites } from "../sites.ts";

// The hospital selector (D-051), in the top bar and in Settings. A native select: it opens with the keyboard
// and every screen reader knows it. Shown only when the server has more than one hospital.

export function SitePicker({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const { sites, site, multi, setSite } = useSites();
  const id = useId();
  if (!multi) return null;
  return (
    <span className={compact ? "site-picker site-picker-compact" : "site-picker"}>
      <label htmlFor={id} className={compact ? "visually-hidden" : "field-label"}>
        {t(locale, "siteLabel")}
      </label>
      <select
        id={id}
        className="site-select"
        value={site ?? ALL_SITES}
        onChange={(e) => setSite(e.target.value === ALL_SITES ? null : e.target.value)}
        title={compact ? t(locale, "siteMenu") : undefined}
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {siteName(locale, s.id)}
          </option>
        ))}
        <option value={ALL_SITES}>{t(locale, "siteAll")}</option>
      </select>
    </span>
  );
}

/** The line at the top of a page that says which hospital the figures are for; nothing with one hospital. */
export function SiteLine({ locale }: { locale: Locale }) {
  const { site, multi } = useSites();
  if (!multi) return null;
  return <p className="site-line">{site === null ? t(locale, "siteForAll") : t(locale, "siteFor", { site: siteName(locale, site) })}</p>;
}
