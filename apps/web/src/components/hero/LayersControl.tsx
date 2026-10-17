import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { InfoButton } from "../Info.tsx";
import { PHENOTYPE_ORDER } from "./geometry.ts";
import { DEFAULT_LAYERS, encodeLayers, type Layers, type LineKey, PILL_KINDS, WINDOWS, wardCodes } from "./layers.ts";

const Sliders = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);

const KIND_KEY = {
  sentinel: "tlLyKindSentinel",
  cluster: "tlLyKindCluster",
  trend: "tlLyKindTrend",
  data: "tlLyKindData",
} as const;

interface Props {
  locale: Locale;
  layers: Layers;
  onChange: (next: Layers) => void;
  /** Show the word next to the icon (wide bands only). */
  withLabel: boolean;
  /** The units that have a signal in view: one click shows only those. */
  signalUnits?: readonly string[];
}

function Chip({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  type: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="ly-chip" data-type={type}>
      <input type={type} name={name} checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

/** The quiet "Layers" button on the band and its small popover: checkboxes and radio groups, Esc closes. */
export function LayersControl({ locale, layers, onChange, withLabel, signalUnits }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("input")?.focus();
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const set = (patch: Partial<Layers>) => onChange({ ...layers, ...patch });
  const setLine = (k: LineKey) => set({ lines: { ...layers.lines, [k]: !layers.lines[k] } });
  const setUnits = (on: boolean) => set({ units: Object.fromEntries(wardCodes().map((u) => [u, on])) });
  const changed = encodeLayers(layers) !== "";
  const label = t(locale, "tlLayers");

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc closes the popover from anywhere inside it
    <div
      className="ly"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <InfoButton locale={locale} label={t(locale, "tlInfoLabel")} align="end">
        <ul className="ly-info">
          {(["tlInfoEsbl", "tlInfoMrsa", "tlInfoVre", "tlInfoCpe", "tlInfoCult", "tlInfoRatio", "tlInfoLanes"] as const).map((k) => (
            <li key={k}>{t(locale, k)}</li>
          ))}
        </ul>
      </InfoButton>
      <button
        type="button"
        ref={button}
        className="ly-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={t(locale, "tlLayersLabel")}
        data-changed={changed || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Sliders />
        {withLabel ? <span>{label}</span> : null}
      </button>
      {open ? (
        <div className="ly-panel" id={id} ref={panel} role="dialog" aria-label={t(locale, "tlLayersLabel")}>
          <fieldset className="ly-group">
            <legend>{t(locale, "tlLyLines")}</legend>
            {PHENOTYPE_ORDER.map((p) => (
              <Chip key={p} type="checkbox" checked={layers.lines[p]} onChange={() => setLine(p)}>
                {phenotypeName(p)}
              </Chip>
            ))}
            <Chip type="checkbox" checked={layers.lines.cult} onChange={() => setLine("cult")}>
              {t(locale, "tlLyCultures")}
            </Chip>
          </fieldset>

          <fieldset className="ly-group">
            <legend>{t(locale, "tlLyMetric")}</legend>
            <Chip type="radio" name={`${id}-m`} checked={layers.metric === "count"} onChange={() => set({ metric: "count" })}>
              {t(locale, "tlLyCount")}
            </Chip>
            <Chip type="radio" name={`${id}-m`} checked={layers.metric === "ratio"} onChange={() => set({ metric: "ratio" })}>
              {t(locale, "tlLyRatio")}
            </Chip>
            {layers.metric === "ratio" ? <p className="ly-note">{t(locale, "tlLyRatioNote")}</p> : null}
          </fieldset>

          <fieldset className="ly-group">
            <legend>{t(locale, "tlLyStacking")}</legend>
            <Chip type="radio" name={`${id}-s`} checked={layers.stacked} onChange={() => set({ stacked: true })}>
              {t(locale, "tlLyStacked")}
            </Chip>
            <Chip type="radio" name={`${id}-s`} checked={!layers.stacked} onChange={() => set({ stacked: false })}>
              {t(locale, "tlLyOverlaid")}
            </Chip>
          </fieldset>

          <fieldset className="ly-group">
            <legend>
              {t(locale, "tlLyUnits")}
              <span className="ly-bulk">
                <button type="button" onClick={() => setUnits(true)}>
                  {t(locale, "tlLyAll")}
                </button>
                {signalUnits ? (
                  <button
                    type="button"
                    onClick={() => set({ units: Object.fromEntries(wardCodes().map((u) => [u, signalUnits.includes(u)])) })}
                  >
                    {t(locale, "tlLySignals")}
                  </button>
                ) : null}
                <button type="button" onClick={() => setUnits(false)}>
                  {t(locale, "tlLyNone")}
                </button>
              </span>
            </legend>
            {wardCodes().map((u) => (
              <Chip
                key={u}
                type="checkbox"
                checked={layers.units[u] !== false}
                onChange={() => set({ units: { ...layers.units, [u]: layers.units[u] === false } })}
              >
                <span title={wardName(locale, u)}>{u}</span>
              </Chip>
            ))}
          </fieldset>

          <fieldset className="ly-group">
            <legend>{t(locale, "tlLyKinds")}</legend>
            {PILL_KINDS.map((k) => (
              <Chip
                key={k}
                type="checkbox"
                checked={layers.kinds[k]}
                onChange={() => set({ kinds: { ...layers.kinds, [k]: !layers.kinds[k] } })}
              >
                {t(locale, KIND_KEY[k])}
              </Chip>
            ))}
          </fieldset>

          <fieldset className="ly-group">
            <legend>{t(locale, "tlLyWindow")}</legend>
            {WINDOWS.map((w) => (
              <Chip key={w} type="radio" name={`${id}-w`} checked={layers.window === w} onChange={() => set({ window: w })}>
                {w ? t(locale, "tlLyWeeks", { n: w }) : t(locale, "tlLyWholeHistory")}
              </Chip>
            ))}
          </fieldset>

          {changed ? (
            <button type="button" className="ly-reset" onClick={() => onChange(DEFAULT_LAYERS)}>
              {t(locale, "tlLyReset")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
