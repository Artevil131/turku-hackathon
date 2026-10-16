# Replay timeline: build spec

Files: `apps/web/src/components/Timeline.tsx`, `AsOf.tsx`, `timeline.css` (imported by `Timeline.tsx`), `App.tsx` mount, `TopBar.tsx` removal, i18n keys below. Do not edit `styles.css`.

## Borrowed patterns

1. **Video player transport** (YouTube-style): one track, play/pause left, time readout beside it, chapter markers on the track, Space/arrow keys.
2. **Chart event flags** (TradingView earnings markers): labelled diamonds under the time axis that jump to an event.
3. **Monitoring time picker** (Grafana): persistent "as of" readout, a state word, controls greyed with a reason.

## Interaction

- **Track**: native `<input type="range">`, min 0, max = days from `clock.start` to `clock.end`, value = day index of `asOf`. `onInput` updates only a local preview date (thumb tooltip + readout). `onChange` commits `command({action:"seek", date})` with a 250 ms debounce (a drag seeks once, on release).
- **Play/pause**: `play`/`pause`, one button with icon, `aria-label`, and a state word (below).
- **Speed**: segmented, four `configure` steps: `1 d / 2 s` (tickMs 2000, daysPerTick 1, default), `1 d / s` (1000, 1), `1 wk / s` (1000, 7), `1 mo / s` (1000, 30). Selected step derived from `clock`.
- **Step**: `step` with days −7, −1, +1, +7. Order: week back, day back, day forward, week forward.
- **Events**: markers under the track at `dayIndex/days` %, 44 px targets, diamond + caption (caption hidden under 980 px, kept in `aria-label`). Click seeks then pauses. The same three in an "Events" button menu (Esc closes). 2025-05-12 `tlEventUro`, 2025-11-17 `tlEventGap`, 2026-02-10 `tlEventIcu`.
- **Keyboard** (document `keydown`): Space play/pause, ←/→ ±1 day, Shift+←/→ ±7, Home/End. Ignore when the target is `input, textarea, select, [contenteditable]`, inside `[role=dialog]`, or inside the Timeline (the range handles its own keys); no `preventDefault` then.
- **"Replayed" legibility**: a chip `tlReplayLabel` at the far left, never hidden. Beside the readout a glyph + word: `tlPlaying` with the pulse dot, `livePaused` with a pause glyph, `tlAtEnd`, `connecting`, `offlineShort`. Under the readout: `tlArrivalsOn` from `lastArrivals`.

## Placement

- Laptop: a second glass row under the TopBar, full width, 52 px, `glass ply-1`. `App.tsx` mounts `<Timeline>` after `<TopBar>`; `timeline.css` sets `.console:has(.timeline) { grid-template-rows: auto auto minmax(0,1fr) }`. Order: chip · play · steps · readout+state · track (flex 1, markers under) · speed · events. Not sticky: the main area scrolls inside the grid.
- Phone (≤ 760 px): 52 px strip, `position: sticky; top: 0; z-index: 20`: state glyph+word · date · play (44 px) · `tlOpen` chevron (44 px). Date or chevron opens a bottom sheet (`role="dialog" aria-modal="true" aria-labelledby`), focus moved in and trapped, Esc/backdrop/`tlClose` close. Sheet stacks: chip, readout+state+arrivals, track with markers, steps (4 × 44 px), speed (4 × 44 px), events list, close.

## AsOf

`<AsOf locale date pending? />` → `<span class="asof">` with `asOfShort` via `formatDate(locale, date, "long")`; when `pending` (the panel's fetched as-of differs from `clock.asOf`) append ` · ` + `asOfUpdating` with the clock date. Every panel `<h2>/<h3>` wraps title and `<AsOf>` in one element (U3). `date` is the panel's own fetched as-of, i.e. its last update.

## States

- **connecting**: controls `disabled`, readout `connecting`, empty track.
- **offline**: controls disabled, readout `offlineShort`, helper `tlOfflineReason`, last date stays.
- **at end**: play and forward steps disabled, word `tlAtEnd`, thumb at 100 %.
- **seeking** (commit until next `clock`/`reset` event): readout `tlSeeking` with target date, `aria-busy="true"`; controls stay enabled, newer commit supersedes.

## Props and removal

```ts
interface TimelineProps { locale: Locale; clock: ClockState | null; connection: Connection;
  lastArrivals: { to: string; count: number } | null; command: (c: ClockCommand) => void; reducedMotion: boolean }
```
Remove from `TopBar.tsx`: the `.clock-mini` block and props `clock`, `connection`, `lastArrivals`, `command`. Keep `Play`, `Pause`, `StepDay` in `Icons.tsx`; add `StepWeek`, `Chevron`.

## i18n keys (en / fi)

- tlReplayLabel: "Replay · synthetic lab feed" / "Toisto · synteettinen laboratoriosyöte"
- tlPlaying: "Playing" / "Toistetaan"
- tlAtEnd: "End of dataset" / "Aineiston loppu"
- tlSeeking: "Moving to {date}" / "Siirrytään: {date}"
- tlOfflineReason: "Controls off: server not reachable" / "Säätimet pois käytöstä: palvelin ei vastaa"
- tlScrub: "Replay date" / "Toistopäivä"
- tlStepBackDay: "Back one day" / "Päivä taaksepäin"
- tlStepBackWeek: "Back one week" / "Viikko taaksepäin"
- tlStepWeek: "Forward one week" / "Viikko eteenpäin"
- tlSpeed: "Speed" / "Nopeus"
- tlSpeedDay2s: "1 day / 2 s" / "1 pv / 2 s"; tlSpeedDay: "1 day / s" / "1 pv / s"; tlSpeedWeek: "1 week / s" / "1 vk / s"; tlSpeedMonth: "1 month / s" / "1 kk / s"
- tlEvents: "Events" / "Tapahtumat"
- tlEventUro: "Urology outbreak arriving" / "Urologian epidemia alkaa"
- tlEventGap: "Sampling gap at Health centre South" / "Näytekatko Terveysasema Etelässä"
- tlEventIcu: "ICU MRSA" / "Teho-osaston MRSA"
- tlOpen: "Open timeline" / "Avaa aikajana"; tlClose: "Close" / "Sulje"
- tlArrivalsOn: "{n} isolates arrived for {date}" / "{n} isolaattia saapui, {date}"
- tlShortcuts (track `title`): "Space play/pause · ← → day · Shift+← → week" / "Välilyönti toista/tauko · ← → päivä · Shift+← → viikko"
- asOfShort: "as of {date}" / "tilanne {date}"
- asOfUpdating: "updating to {date}" / "päivitetään: {date}"

Reused: `asOf`, `play`, `pause`, `stepDay`, `livePaused`, `connecting`, `offlineShort`.

## Accessibility

- Range: `aria-label={tlScrub}`, `aria-valuemin/max/now`, `aria-valuetext` = the preview date, long format.
- Focus order: play → steps → track → speed → events → (phone) chevron; `:focus-visible` outline `2px solid var(--live)`.
- Targets 44 px on phone, 36 px laptop; markers 44 px always.
- `reducedMotion` or `prefers-reduced-motion`: no pulse, no sheet slide, no thumb transition.
