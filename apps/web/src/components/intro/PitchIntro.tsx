import { type AeiClient, ApiError, type CountiesResponse, type RegionalResponse } from "@aei/contract";
import { formatDate, formatMonth, type Locale, t } from "@aei/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildGrid, cellAt, flatTerraces, type Grid, HOSPITALS, LINKS, parseHex, type Terraces, terraces, toKm } from "./surface.ts";
import "./intro.css";

// The pitch intro (#intro): a terraced 3D picture of the county pressure of Finland, ported from
// scripts/explore/surface.html and drawn on one canvas. A picture of pressure between county figures,
// not a working view: the stepped map on the researcher's board carries the numbers.

export interface PitchIntroProps {
  client: AeiClient;
  locale: Locale;
  /** The replay clock's date; null while connecting. */
  asOf: string | null;
  /** Leaves the intro for the working tool. */
  onEnter: () => void;
  reducedMotion: boolean;
}

const GROUP = "MRSA carriage";
const NATIONAL = "Finland (all counties)";
const STEPS = 6;
const STEP_H = 15; // km of height per terrace, a drawing choice
const PITCH0 = 0.95;
const YAW0 = -0.3;
const SWAY = 0.45;
const STEP_IDS = [0, 1, 2, 3, 4, 5];

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "404" } | { state: "error" };

function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[]): Load<T> {
  const [res, setRes] = useState<Load<T>>({ state: "loading" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher is rebuilt each render; deps say when to refetch
  useEffect(() => {
    let live = true;
    setRes({ state: "loading" });
    fetcher().then(
      (data) => live && setRes({ state: "ok", data }),
      (e) => live && setRes(e instanceof ApiError && e.status === 404 ? { state: "404" } : { state: "error" }),
    );
    return () => {
      live = false;
    };
  }, [...deps, 0]);
  return res;
}

const num = (locale: Locale, v: number, digits = 1) =>
  new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: digits }).format(v);

/** What the draw loop needs, kept in a ref so the loop never restarts. */
interface Scene {
  grid: Grid;
  terr: Terraces;
  /** Rate per county, null where THL gives none. */
  rates: (number | null)[];
  flat: boolean;
}

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const css = (c: RGB, k = 1) => `rgb(${Math.round(c[0] * k)} ${Math.round(c[1] * k)} ${Math.round(c[2] * k)})`;

function rampColours(live: RGB, flat: boolean): RGB[] {
  if (flat) return [[216, 228, 238]];
  const pale: RGB = [226, 238, 247];
  return Array.from({ length: STEPS }, (_, i) => mix(pale, mix(live, [6, 52, 96], 0.25), i / (STEPS - 1)));
}

export function PitchIntro({ client, locale, asOf, onEnter, reducedMotion }: PitchIntroProps) {
  const [pick, setPick] = useState<string | null>(null);
  const regional = useLoad<RegionalResponse>(() => client.regional({ group: GROUP }), [client, asOf]);
  const counties = useLoad<CountiesResponse>(() => client.counties(), [client]);

  const grid = useMemo(() => (counties.state === "ok" ? buildGrid(counties.data.features) : null), [counties]);

  const data = regional.state === "ok" ? regional.data : null;
  const months = data?.months ?? [];
  const latest = months.length - 1;
  const idx = pick !== null && months.includes(pick) ? months.indexOf(pick) : latest;
  const month = months[idx] ?? null;

  const scene: Scene | null = useMemo(() => {
    if (!grid) return null;
    if (!data || idx < 0) return { grid, terr: flatTerraces(grid), rates: grid.names.map(() => null), flat: true };
    const byRegion = new Map(data.series.map((s) => [s.region, s]));
    const rates = grid.names.map((n) => byRegion.get(n)?.incidencePer100k?.[idx] ?? null);
    return { grid, terr: terraces(grid, rates, STEPS), rates, flat: false };
  }, [grid, data, idx]);

  const national = data?.series.find((s) => s.region === NATIONAL)?.cases[idx] ?? null;
  const nFigures = scene && !scene.flat ? scene.rates.filter((r) => r !== null).length : (grid?.names.length ?? 23);
  const monthLong = month ? formatMonth(locale, `${month}-01`, true) : "";
  const loading = counties.state === "loading" || regional.state === "loading";
  const noGeo = counties.state === "404" || counties.state === "error";
  const noRegional = counties.state === "ok" && (regional.state === "404" || regional.state === "error");
  const noMonths = data !== null && months.length === 0;

  // ---- canvas ----
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const motionRef = useRef(!reducedMotion);
  const dirty = useRef(true);
  const cam = useRef({ yaw: YAW0, pitch: PITCH0, phase: 0 });
  sceneRef.current = scene;
  motionRef.current = !reducedMotion;
  // biome-ignore lint/correctness/useExhaustiveDependencies: any new picture needs one redraw
  useEffect(() => {
    dirty.current = true;
  }, [scene, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const stage = stageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !root || !stage || !ctx) return;
    const style = getComputedStyle(root);
    const live = parseHex(style.getPropertyValue("--live"), [10, 99, 168]);
    const ink = parseHex(style.getPropertyValue("--ink"), [16, 34, 46]);
    const font = style.getPropertyValue("--font-ui").trim() || "system-ui, sans-serif";

    let W = 0;
    let H = 0;
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let fit = { scale: 1, ox: 0, oy: 0 };
    let fitFor: Scene | null = null;
    let fitKey = "";
    const buf = new Float64Array(2);
    const P = (x: number, y: number, h: number, c: number, s: number, cp: number, sp: number) => {
      const rx = x * c - y * s;
      const ry = x * s + y * c;
      buf[0] = rx;
      buf[1] = ry * cp - h * sp;
    };

    const measure = () => {
      const r = root.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      box = { x: sr.left - r.left, y: sr.top - r.top, w: sr.width, h: sr.height };
      fitKey = "";
      dirty.current = true;
    };

    // Scale and offset so the whole terraced land stays in the stage over the whole sway.
    const refit = (sc: Scene) => {
      const key = `${box.w}x${box.h}`;
      if (fitFor === sc && fitKey === key) return;
      fitFor = sc;
      fitKey = key;
      const g = sc.grid;
      const hMax = sc.terr.steps * STEP_H;
      const cp = Math.cos(PITCH0);
      const sp = Math.sin(PITCH0);
      let x0 = 1e9;
      let x1 = -1e9;
      let y0 = 1e9;
      let y1 = -1e9;
      for (let n = 0; n < g.land.length; n += 5) {
        const k = g.land[n] as number;
        for (const yaw of [YAW0 - SWAY - 0.1, YAW0, YAW0 + SWAY + 0.1])
          for (const h of [0, hMax]) {
            P(g.x[k] as number, g.y[k] as number, h, Math.cos(yaw), Math.sin(yaw), cp, sp);
            x0 = Math.min(x0, buf[0] as number);
            x1 = Math.max(x1, buf[0] as number);
            y0 = Math.min(y0, buf[1] as number);
            y1 = Math.max(y1, buf[1] as number);
          }
      }
      const scale = Math.min((box.w * 0.97) / (x1 - x0 || 1), (box.h * 0.97) / (y1 - y0 || 1));
      fit = { scale, ox: box.x + box.w / 2 - ((x0 + x1) / 2) * scale, oy: box.y + box.h / 2 - ((y0 + y1) / 2) * scale };
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, W, H);
      const sc = sceneRef.current;
      if (!sc) return;
      refit(sc);
      const g = sc.grid;
      const { terr } = sc;
      const motion = motionRef.current;
      const yaw = cam.current.yaw + (motion ? SWAY * Math.sin(cam.current.phase) : 0);
      const pitch = cam.current.pitch;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const { scale, ox, oy } = fit;
      const px = (x: number, y: number, h: number): [number, number] => {
        P(x, y, h, c, s, cp, sp);
        return [ox + (buf[0] as number) * scale, oy + (buf[1] as number) * scale];
      };
      const cols = rampColours(live, sc.flat);
      const heightOf = (k: number) => ((terr.level[k] as number) + 1) * STEP_H;
      const hw = g.cw / 2;
      const hh = g.ch / 2;

      // ground shadow under the slab
      const [gx, gy] = px(0, 0, 0);
      const grad = ctx.createRadialGradient(gx, gy + 8, 10, gx, gy + 8, 330 * scale);
      grad.addColorStop(0, "rgba(16,42,67,0.16)");
      grad.addColorStop(1, "rgba(16,42,67,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(gx, gy + 12, 340 * scale, 560 * scale * cp, 0, 0, 7);
      ctx.fill();

      // cells back to front
      const order = Array.from(g.land);
      const depth = (k: number) => (g.x[k] as number) * s + (g.y[k] as number) * c;
      order.sort((a, b) => depth(a) - depth(b));
      const sides: [number, number, number][] = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
      ];
      ctx.lineJoin = "round";
      for (const k of order) {
        const h = heightOf(k);
        const col = cols[Math.min(cols.length - 1, terr.level[k] as number)] as RGB;
        const x = g.x[k] as number;
        const y = g.y[k] as number;
        const i = k % g.nx;
        const j = (k - i) / g.nx;
        // walls where the neighbour is lower, facing the viewer only
        for (const [dx, dy] of sides) {
          const ny = dx * s + dy * c;
          if (ny <= 0.02) continue;
          const ii = i + dx;
          const jj = j + dy;
          const nk = ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny ? -1 : jj * g.nx + ii;
          // a coast is a slab edge one and a half terraces deep, not a drop to the ground
          const hn = nk >= 0 && (g.county[nk] as number) >= 0 ? heightOf(nk) : Math.max(0, h - 1.5 * STEP_H);
          if (hn >= h) continue;
          const ax = dx === 0 ? x - hw : x + dx * hw;
          const ay = dy === 0 ? y - hh : y + dy * hh;
          const bx = dx === 0 ? x + hw : x + dx * hw;
          const by = dy === 0 ? y + hh : y + dy * hh;
          const a1 = px(ax, ay, h);
          const b1 = px(bx, by, h);
          const b0 = px(bx, by, hn);
          const a0 = px(ax, ay, hn);
          const sx = dx * c - dy * s;
          const wall = css(col, 0.82 - 0.06 * sx);
          ctx.fillStyle = wall;
          ctx.strokeStyle = wall;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a1[0], a1[1]);
          ctx.lineTo(b1[0], b1[1]);
          ctx.lineTo(b0[0], b0[1]);
          ctx.lineTo(a0[0], a0[1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.62)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a1[0], a1[1]);
          ctx.lineTo(b1[0], b1[1]);
          ctx.stroke();
        }
        const p0 = px(x - hw, y - hh, h);
        const p1 = px(x + hw, y - hh, h);
        const p2 = px(x + hw, y + hh, h);
        const p3 = px(x - hw, y + hh, h);
        const top = css(col);
        ctx.fillStyle = top;
        ctx.strokeStyle = top;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // hospitals
      const pos = new Map<string, { p: [number, number]; v: number; x: number; y: number; h: number }>();
      for (const hp of HOSPITALS) {
        const k = cellAt(g, hp.lon, hp.lat);
        const [x, y] = toKm(hp.lon, hp.lat);
        const h = (k >= 0 ? heightOf(k) : STEP_H) + 3;
        const ci = g.names.indexOf(hp.county);
        pos.set(hp.id, { p: px(x, y, h), v: sc.rates[ci] ?? 0, x, y, h });
      }
      const narrow = W < 640;
      // links with a pulse travelling from the higher-rate end to the lower
      LINKS.forEach(([a, b, w], n) => {
        const A = pos.get(a);
        const B = pos.get(b);
        if (!A || !B) return;
        const from = A.v >= B.v ? A : B;
        const to = from === A ? B : A;
        const mx = (from.p[0] + to.p[0]) / 2;
        const my = (from.p[1] + to.p[1]) / 2 - (14 + 0.22 * Math.hypot(to.p[0] - from.p[0], to.p[1] - from.p[1]));
        ctx.strokeStyle = `rgba(16,34,46,${0.22 + 0.2 * w})`;
        ctx.lineWidth = w === 1 ? 1 : 1.6;
        ctx.beginPath();
        ctx.moveTo(from.p[0], from.p[1]);
        ctx.quadraticCurveTo(mx, my, to.p[0], to.p[1]);
        ctx.stroke();
        if (!motion) return;
        const ph = (time * 0.28 + n * 0.173) % 1;
        const u = 1 - ph;
        const qx = u * u * from.p[0] + 2 * u * ph * mx + ph * ph * to.p[0];
        const qy = u * u * from.p[1] + 2 * u * ph * my + ph * ph * to.p[1];
        ctx.fillStyle = `rgba(255,255,255,${0.95 * Math.sin(Math.PI * ph)})`;
        ctx.strokeStyle = `rgba(16,34,46,${0.8 * Math.sin(Math.PI * ph)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(qx, qy, w === 1 ? 2.6 : 3.2, 0, 7);
        ctx.fill();
        ctx.stroke();
      });
      HOSPITALS.forEach((hp, n) => {
        const o = pos.get(hp.id);
        if (!o) return;
        const ph = motion ? (time * 0.35 + n * 0.37) % 1 : 0.35;
        const reach = (hp.uni ? 70 : 38) * (0.25 + 0.75 * ph);
        ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - ph)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let q = 0; q <= 28; q++) {
          const ang = (q / 28) * Math.PI * 2;
          const pt = px(o.x + Math.cos(ang) * reach, o.y + Math.sin(ang) * reach, o.h);
          if (q === 0) ctx.moveTo(pt[0], pt[1]);
          else ctx.lineTo(pt[0], pt[1]);
        }
        ctx.stroke();
      });
      hospitalsDot(ctx, pos, narrow, font, live, ink);
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (motionRef.current) {
        if (!dragging) cam.current.phase += dt * 0.16;
        draw(now / 1000);
      } else if (dirty.current) {
        draw(0);
      }
      dirty.current = false;
      raf = requestAnimationFrame(loop);
    };

    let dragging: { x: number; y: number; yaw: number; pitch: number } | null = null;
    const down = (e: PointerEvent) => {
      dragging = { x: e.clientX, y: e.clientY, yaw: cam.current.yaw, pitch: cam.current.pitch };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("is-dragging");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      cam.current.yaw = dragging.yaw + (e.clientX - dragging.x) * 0.008;
      cam.current.pitch = Math.min(1.3, Math.max(0.5, dragging.pitch + (e.clientY - dragging.y) * 0.006));
      dirty.current = true;
    };
    const up = () => {
      dragging = null;
      canvas.classList.remove("is-dragging");
    };
    const key = (e: KeyboardEvent) => {
      const step = 0.12;
      if (e.key === "ArrowLeft") cam.current.yaw -= step;
      else if (e.key === "ArrowRight") cam.current.yaw += step;
      else if (e.key === "ArrowUp") cam.current.pitch = Math.max(0.5, cam.current.pitch - step / 2);
      else if (e.key === "ArrowDown") cam.current.pitch = Math.min(1.3, cam.current.pitch + step / 2);
      else return;
      e.preventDefault();
      dirty.current = true;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(stage);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("keydown", key);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("keydown", key);
    };
  }, []);

  // Enter and Escape leave the intro (a focused button handles its own Enter).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnter();
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) onEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter]);

  const asOfText = asOf ?? data?.asOf ?? null;
  const rangeLo = scene && !scene.flat ? num(locale, scene.terr.lo) : "";
  const rangeHi = scene && !scene.flat ? num(locale, scene.terr.hi) : "";
  const message = noGeo
    ? t(locale, "introNoGeo")
    : noRegional
      ? t(locale, "introNoRegional")
      : noMonths
        ? t(locale, "introNoMonths")
        : null;

  return (
    <div className="intro" ref={rootRef} lang={locale}>
      <canvas ref={canvasRef} className="intro-canvas" tabIndex={0} role="img" aria-label={t(locale, "introCanvas")} />
      <header className="intro-copy">
        <h1 className="intro-title">{t(locale, "introTitle")}</h1>
        <p className="intro-sub">{t(locale, "introSubtitle")}</p>
      </header>
      <div className="intro-stage" ref={stageRef}>
        {loading ? (
          <p className="intro-state" role="status">
            {t(locale, "introLoading")}
          </p>
        ) : message ? (
          <p className="intro-state intro-state-note" role="status">
            {message}
          </p>
        ) : null}
        {!loading && !noGeo ? <p className="intro-drag">{t(locale, "introHint")}</p> : null}
      </div>
      <div className="intro-cta">
        <button type="button" className="intro-enter" onClick={onEnter}>
          {t(locale, "introEnter")}
          <span aria-hidden="true" className="intro-enter-arrow">
            →
          </span>
        </button>
        <span className="intro-enter-key">{t(locale, "introEnterKey")}</span>
      </div>
      <section className="intro-dock">
        {/* The caption describes the picture: without county figures there is nothing for it to describe. */}
        {noGeo || noRegional ? null : <p className="intro-picture">{t(locale, "introPicture", { n: nFigures })}</p>}
        {data && months.length > 0 ? (
          <div className="intro-month">
            <div className="intro-month-head">
              <span className="intro-series">
                <span className="intro-label">{t(locale, "introSeriesLabel")}</span> {t(locale, "introSeriesName")}
              </span>
              <output className="intro-month-now">
                {monthLong}
                {idx === latest ? <span className="intro-latest"> · {t(locale, "introMonthLatest")}</span> : null}
              </output>
            </div>
            <input
              type="range"
              className="intro-slider"
              min={0}
              max={latest}
              value={idx}
              onChange={(e) => setPick(months[Number(e.target.value)] ?? null)}
              aria-label={t(locale, "introSlider")}
              aria-valuetext={t(locale, "introMonthShown", { month: monthLong })}
            />
          </div>
        ) : null}
        {scene && !scene.flat ? (
          <div className="intro-legend">
            <div className="intro-swatches" role="img" aria-label={t(locale, "introTerraces")}>
              {STEP_IDS.map((i) => (
                <span key={`step-${i}`} className="intro-swatch" data-step={i} />
              ))}
            </div>
            <div className="intro-swatch-ends" aria-hidden="true">
              <span>{t(locale, "introLegendLow")}</span>
              <span>{t(locale, "introLegendHigh")}</span>
            </div>
            <p className="intro-legend-text">
              {t(locale, "introLegend", { lo: rangeLo, hi: rangeHi, month: monthLong, n: nFigures })}
              {national !== null ? ` ${t(locale, "introNational", { cases: num(locale, national, 0), month: monthLong })}.` : null}
            </p>
          </div>
        ) : null}
        {noGeo ? null : <p className="intro-note">{t(locale, "introHospitals")}</p>}
        <p className="intro-note">{t(locale, "introSource", { asOf: asOfText ? formatDate(locale, asOfText, "long") : "…" })}</p>
      </section>
    </div>
  );
}

/** Dots and labels of the hospitals, drawn last so they sit on top of the terraces and links. */
function hospitalsDot(
  ctx: CanvasRenderingContext2D,
  pos: Map<string, { p: [number, number] }>,
  narrow: boolean,
  font: string,
  live: RGB,
  ink: RGB,
): void {
  const inkCss = css(ink);
  for (const hp of HOSPITALS) {
    const o = pos.get(hp.id);
    if (!o) continue;
    const isTyks = hp.id === "Tyks";
    const r = hp.uni ? (narrow ? 5 : 6.5) : narrow ? 2.8 : 3.4;
    const [x, y] = o.p;
    if (isTyks) {
      ctx.strokeStyle = css(live);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, 7);
      ctx.stroke();
    }
    ctx.fillStyle = isTyks ? inkCss : "#ffffff";
    ctx.strokeStyle = isTyks ? "#ffffff" : inkCss;
    ctx.lineWidth = isTyks ? 2 : 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
  ctx.textBaseline = "middle";
  for (const hp of HOSPITALS) {
    if (!hp.uni) continue;
    const o = pos.get(hp.id);
    if (!o) continue;
    const [x, y] = o.p;
    const isTyks = hp.id === "Tyks";
    const left = hp.id === "Tyks" || hp.id === "Tays";
    const label = isTyks ? "Tyks · Turku" : hp.id;
    ctx.font = `${isTyks ? 700 : 600} ${narrow ? 11 : 13}px ${font}`;
    const wText = ctx.measureText(label).width;
    const gap = 11;
    const tx = left ? x - gap - wText : x + gap;
    if (isTyks) {
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.strokeStyle = css(live);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(tx - 6, y - 11, wText + 12, 22, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = inkCss;
      ctx.fillText(label, tx, y + 0.5);
    } else {
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(label, tx, y + 0.5);
      ctx.fillStyle = inkCss;
      ctx.fillText(label, tx, y + 0.5);
    }
  }
}
