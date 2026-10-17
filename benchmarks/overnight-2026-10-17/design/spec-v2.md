# Spec v2: one screen, timeline first, Mylab look

Ordered 08:50, built by 12:00 by four builders (A–D, section 7) on disjoint files, under agent-context.md (bounds, wording, AA, no colour alone, numbers only from the API, every key in `en.ts` and `fi.ts`).

Borrowed: **Bloomberg terminal** (one screen, tabular figures, one-word labels, detail on demand); **Grafana** (an annotation band on a shared time axis every panel hangs under; scrub and play); **Epic's patient banner** (one dense context row instead of a filter form). Look from Mylab: flat white, navy text, one violet, tight grid, no glass.

## 1. Visual language (builder A)

Replace the first `:root` block in `apps/web/src/styles.css`:

```
--brand-accent: #635BF1;  --brand-accent-soft: #ECEBFC;  --brand-accent-ink: #FFFFFF;
--brand-accent-line: #C6C4ED;
--brand-font-ui: "Inter", "Segoe UI", system-ui, sans-serif;
--brand-font-data: "Inter", "Segoe UI", system-ui, sans-serif;
--brand-font-display: "Bricolage Grotesque", "Inter", system-ui, sans-serif;
--brand-radius: 10px;
```

Neutrals and status (second block): `--chassis #F8F8F8` (page ground, flat, no gradients, `--chassis-lit/-warm` = chassis), `--ink #07081C`, `--ink-2 #1D204E`, `--ink-3 #6F7292` (4.7:1 on white), `--line #E4E6EE`, `--line-strong #AEBECB`, `--glass-1/2/3 #FFFFFF`, `--blur-* 0`, `--glass-shadow none`, `--pop-shadow 0 4px 16px rgb(7 8 28 / 0.12)` (popovers only). Status: `--st-alert #D0004B` with `--st-alert-bg #FDE3E9`; `--st-watch #94590A` / `#FDF3E2`; `--st-ok #17784A`; `--resist #1D204E` (resistance is navy fill, susceptible white; the R glyph stays). Delete every `backdrop-filter` and gradient in all css (grep); surfaces are white panels, 1 px `--line` border, radius 10, no shadow. Dark block: same roles.

Fonts: Google Fonts `<link>` for Inter 400/500/600 and Bricolage Grotesque 600 in `apps/web/index.html` (a stylesheet, not a package). Display font only for page titles, the as-of date and hero numbers; `tabular-nums` on `body`.

Type scale, four sizes: `--t-xs 12px` (axis, counts, chips), `--t-s 13px` (table rows, labels), `--t-m 15px` (body, buttons), `--t-l 22px` (page title, hero number); weights 400/500/600 only. Spacing on a 4 px grid: panel padding 12, gaps 8, row height 32 (36 in the forest plot). Controls radius 6, height 28; selected state = `--brand-accent` fill, white text; focus ring 2 px `--brand-accent` offset 2. Icons: 16 px, 1.5 px stroke, `currentColor` (as `Icons.tsx`); add `Info`, `Levels`, `Tick`, `Cross`, `Approx`.

Top bar 48 px: "AEI" in display font, three page tabs, command field, EN/FI, settings; no subtitle.

## 2. Text budget (all builders)

Rules: labels 1–3 words; no visible sentence over 12 words; at most one sentence per panel, stating a number; every explanation behind an ⓘ button (`<button aria-expanded>` + popover; Enter/Space/tap opens, Esc closes, focus returns; never hover-only). Numbers in the compact form `97 % · n 355`, intervals `95–98`, dates `12.5.2025`, as-of once per panel header as `12.5.2025` (date only). Per surface:

- **Home** (A): remove the subtitle, the role descriptions and the "Katso esittelyanimaatio…" line (intro link moves to settings). Keep the three "since yesterday" figures as one stat row; buttons "Lääkäri", "Tutkimus".
- **Timeline** (B): the replay pill becomes ⓘ by the date; "Tauolla" goes; speeds become one select.
- **Doctor** (C): per-row sentences and chips ("ylittää rajan 80 % 355 löydöksellä…", "tulokset … asti", "oma yksikkö ±2 %-yks.", "ei kata …") move to the details pane; title → "Kattavuus"; the pool line becomes the level ladder; one-word column headers.
- **Research** (D): "13 signaalia 365 päivässä" → header `13 · 365 pv`; card prose ("havaittu 7 · tavallisesti 1,4 · p < 0,001", "ei yhtään … jälkeen") → the math panel; the grid note ("Sävy kertoo…") → ⓘ; filter labels → icon + one word.

## 3. The timeline hero (builder B)

A full-width band under the top bar on every page; 72 px laptop, 56 phone. Left cluster 220 px: play/pause, −1 d, +1 d, speed `<select>`, the as-of date in display font 22 px with an ⓘ ("synthetic replay, 2023-10-02 → 2026-09-27"). The rest is one `<svg>`, x = (day − startDay)/(endDay − startDay) over `clock.start..clock.end`:

- Ground: future (x > asOf) filled `--chassis`; past white. Year ticks and month minor ticks at the bottom (12 px axis).
- **Seismograph track** (40 px): one mark per alert at its date. Height = min(−log10 p, 6)/6 × 40 px for detector alerts with `p`; sentinels (`cpe`, `new-in-unit`, no `p`) full height. Glyph by kind, colour secondary: sentinel = triangle cap, `--st-alert`; cluster (`profile-excess`, `phenotype-excess`) = solid bar, `--ink-2`; trend (`rising-trend`) = bar with chevron cap, `--brand-accent`; data (`sampling-drop`, `empty-run`) = hollow bar, `--ink-3`. Alerts sharing `incident` get a 2 px bracket under the axis. Baseline label "−log10 p" at the left, "6+" at the top, `--t-xs`.
- The three planted-event diamonds (`EVENTS`) stay on the axis, outlined, greyed in the future.
- As-of cursor: 2 px `--brand-accent` line, full height, with a draggable handle.

Interaction: marks are `<g role=button tabindex=0>` (arrow keys between them); hover/focus → tooltip (feed name, unit, date, `observed · expected · −log10 p`); click/Enter → `location.hash = "#research?incident=<id>"` (D opens it). Drag the axis or handle → `seek`, one POST per 150 ms, final on release; ←/→ = step. Play/pause as today.

Data: on mount and on each `reset` event, `client.alerts({ from: clock.start })` once (21 alerts in the demo span, under a hundred over three years), then append from live `alerts` events; a tiny store in `apps/web/src/alertsSince.ts` (`useAlertsSinceStart()`). At most a few hundred `<rect>`s, re-rendered only when the list or `asOf` changes; the cursor moves by CSS transform. No second track now; proposal: optional `GET /api/counts?by=day` for daily arrivals (`isolates` is too heavy for the whole period).

## 4. Doctor workspace (builder C)

No page scroll at 1280×800 or 1440×900: `.doctor { height: calc(100dvh - 120px); display: grid; grid-template-rows: 40px 1fr; }`; inner panels scroll themselves.

**Row 1, banner (40 px, Epic-style):** unit `<select>` · specimen segmented · sex segmented · severity segmented (`lievä 80 %` / `vaikea 90 %`) · age segmented · onset toggle · period toggle. One row at 1280 with 8 px gaps and `--t-s`; overflow-x scroll on phone.

**Row 2, two columns 62 / 38.**

Left: **forest plot**, one 36 px row per antibiotic: name + AWaRe chip (`A`/`W`, `title`) 170 px · bar area (flex; axis 50–100 %; interval 4 px bar, point 8 px dot, dashed threshold line at τ from `THRESHOLDS`, labelled "raja 80 %" once in the header) · `97 % · n 355` 110 px · level glyph 24 px (● unit, ◐ ward type, ○ hospital, `title`) · result glyph + word 100 px (✓ ylittää / ≈ raja / ✕ alle / – ei arvioitavissa, from `standing`) · ⓘ. Rows form a `listbox`; arrows move, Enter selects. Pairs (severe only) follow a divider as `MEM + VAN`. Header: `Kattavuus · 12.5.2025` and the level ladder.

Right, stacked: **level ladder** (6.3) · **likely organisms** (one stacked bar of `organisms[].share` plus 7 rows `E. coli 51 % · n 235`, 20 px each) · **unit signals, 28 d** (chips: glyph + ≤4 words + date; tap → ⓘ) · **details pane** for the selected row: the former inline sentence, chips `recent 28 d: n 12`, `not covering: E. faecalis 11 %`, `untested`, `outside spectrum`, explain button; empty state "Valitse rivi".

Phone (≤720 px): banner → forest plot → organisms → signals; details as a bottom sheet (`role=dialog`).

## 5. Researcher workspace (builder D)

One screen, `calc(100dvh - 120px)`, grid columns `340px 1fr 300px`.

Left: **incidents list**, newest first, 44 px rows: kind glyph · name (≤6 words from the feed templates) · unit · date · 40 px surprise bar (−log10 p, capped 6; full for sentinels). Filter chips in one row above; selected row `--brand-accent-soft`; `incident` from the hash is selected and scrolled to.

Centre: **one large panel** with a 3-segment switcher (grid / network / map, `panel=` as now); no thumbnails, since at 1280 three small multiples are unreadable and triple the SVG cost. Grid is default; a selected incident highlights its unit column and week.

Right: **alert math** for the selected incident (section 6.2), then "Löydökset →" which opens the isolates (`client.isolates({ ward, organism, from, to })`) in a drawer; the AI explanation stays behind "Selitä".

Phone: list → math → panel, stacked.

## 6. Math visualisations (API fields only)

1. **Wilson forest plot** (D-023), doctor list: `share`, `interval`, `counts.known`, τ from `THRESHOLDS`. ⓘ: "95 % Wilson interval of the share of first isolates covered, last 365 days".
2. **Observed vs usual** (detector alerts, D-020): two bars `havaittu 7` / `tavallisesti 1,4` (`observed`, `expected`), `−log10 p = 3.2` as the big number, one line naming the test by `detector` (phenotype-excess "Poisson excess over the unit's baseline"; profile-excess "same rare profile, excess over baseline"; rising-trend "trend over 22 pairs", `observed` as a proportion; sampling-drop/empty-run "cultures below the unit's rate"). Sentinels: "rule, no test", plus `previous` for new-in-unit. Same component for `RegionalSignal` (`cases`, `expected`, `p`; `strong` → "survives Bonferroni over {testedSeriesMonths}" / "may be chance").
3. **Level ladder** (D-033): steps `yksikkö → osastotyyppi → sairaala`; the step equal to `coverage.level` is filled with `n {isolates}` and `from {from}`; earlier steps hollow with "< 30" (true by the rule), later greyed. The API returns only the chosen level, so no other n. `sexApplied=false` adds the chip "sukupuoli pudotettu".
4. **County rate** (D-037), map/side panel: sparkline of `cases` per month, signal months as ● (strong) / ○ (weak) with `expected` as a tick at that month only.
5. **The seismograph** (section 3) is the alert history itself.

Proposals, not built now (need optional contract fields): Beta posterior density (a, b per cell, D-038); weekly expected counts per series (CUSUM path, funnel limits, ENGINE 3.3/3.5); a "how it was tested" panel (0002 detectors on planted events, 0004 coverage estimators, 0009 empty-day runs, 0011 common-profile injections) served by the API as a file, never imported from `experiments/`.

## 7. Ownership and keys

- **A — tokens, shell, home:** `apps/web/index.html`, `src/styles.css`, `src/ai.css`, `src/App.tsx`, `components/TopBar.tsx`, `Home.tsx`, `home/*`, `Settings.tsx`, `Icons.tsx`, `command/*`, `intro/*` (token fallout only); `surfaces/home.ts` and the global keys in `en.ts`/`fi.ts`. Adds `uiInfo` ("Tietoa"), `uiDetails` ("Lisätiedot"), `uiSelectRow` ("Valitse rivi"); removes `homeDoctorLead`, `homeResearchLead`, `homeIntroNote` (keeps `homeIntro` for the settings link).
- **B — timeline hero:** `components/Timeline.tsx`, `timeline.css`, new `components/hero/Seismograph.tsx` + `.css`, new `src/alertsSince.ts`. `url.ts` already has `hashParams()`; B writes `#research?incident=<id>`, D reads it. Adds `tlSurprise` ("−log10 p"), `tlSentinel`, `tlCluster`, `tlTrend`, `tlData`, `tlOpenIncident`, `tlReplayNote`; the pill moves behind ⓘ, so `tlReplayLabel` becomes the ⓘ title; removes `tlPlaying`.
- **C — doctor:** `components/doctor/*`; `surfaces/doctor.ts`. Adds `drCoverage` ("Kattavuus"), `drLadder`, `drLadderUnder30` ("< 30"), `drDetails`, `drSignals28`; reuses `drLevel*Short`, `drStanding*`, `drRecent`, `drSexDropped`, `drLikely`; removes `drReasonClears`, `drReasonBorderline`, `drReasonBelow`, `drResultsTo`, `drPoolLine`, `drPoolLineOne`, `drFoot` from the default view (moved to the details pane or ⓘ, keys kept).
- **D — researcher:** `components/research/*`, `Network.tsx`, `AlertExplanation.tsx`; `surfaces/feed.ts`, `grid.ts`, `map.ts`, `network.ts`, `board.ts`. Adds `feedUsual` ("tavallisesti"), `feedSurprise`, `feedTestPhenotype`, `feedTestProfile`, `feedTestTrend`, `feedTestSampling`, `feedRuleNoTest`, `feedStrong`, `feedWeak`; reuses `feedObserved`, `feedExpected`, `feedIsolatesBehind`; `feedWindow`/`feedWindowOne` become `13 · 365 pv`; `gridNote` moves behind ⓘ.

Nobody edits another builder's files; A lands the tokens within 20 minutes and the others build against the names above from the start. Each builder runs `npx biome check`, `pnpm typecheck`, `pnpm test:ts` and shoots `doctor` and `research` at laptop and phone before reporting.
