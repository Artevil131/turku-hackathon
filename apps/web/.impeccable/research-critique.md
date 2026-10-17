---
version: 1
slug: "research-critique"
primary_target: "apps/web/src/components/research/workspace/Workspace.tsx"
related_targets:
  - "apps/web/src/components/research/math/AlertMath.tsx"
  - "apps/web/src/components/research/SignalFeed.tsx"
  - "apps/web/src/components/research/geo/GeoMap.tsx"
  - "apps/web/src/components/research/geo/UnitGraph.tsx"
---

# Research page, 17 Oct 2026: critique before the fix

Method: single reviewer in the built-in browser at 1440×900, English UI,
default layout, the first open incident selected by a click on its row
(`inc=…MED-A|esbl…`), then "Show on map". Screenshots in the session
scratchpad: `shots/before-selected-1440.jpg`, `shots/before-county-pane-1440.jpg`.
Measured with `getBoundingClientRect` and `getComputedStyle`, not by eye alone.

## Where the eye goes, and where it should

1. **First: the patient flow's centre node** (`.ug-centre-box`, MED-A, navy
   fill, 575×432 px window at the top right). It is the darkest, largest
   shape on the page. Second: the violet **Go to this day** button
   (`.sig-primary`, the only filled accent). Third: the map's violet
   counties. The timeline's purple area chart competes with all three.
2. **Should be: the signal card** (`#ws-win-math`). It is the depth-2
   answer, but it is the third window of the right column, starting at
   y = 601 of a 900 px viewport. Its title (`.sig-title`) is at y = 687,
   the surprise figure (`.sig-surprise`) at y = 795, and the action row
   (`.sig-actions`, 117 px tall) runs to y = 932, under the fold. The card
   has no visual primacy over the other windows: the same 1 px `--line`
   frame, the same white, a smaller area than the flow above it.
3. **The selected feed row is the one strong selection cue** (`aria-current`,
   accent-soft background, 3 px rule), and it is at the far left, 800 px
   away from the card it opened. Nothing draws a line between the two.

## What competes for attention

- The flow window: five units with percentages above and below, a mode
  segment (Around MED-A / All units), a source line and a caption, an ⓘ.
  For a selected signal only the ribbons into and out of MED-A matter.
- The feed header: a filter row (all units / all phenotypes), four kind
  chips with counts (sentinel 6, cluster 4, trend 0, data 3), the window
  count and the as-of date. Six controls before the first signal.
- The map head: a series select (MRSA carriage), a caption, a legend row
  of six swatches. The signal is an ESBL cluster; the map shows MRSA.
- The "Layouts" segment (Default / Map / Signals / Units) sits as its own
  30 px row between the timeline and the board, a tool row at the exact
  point where the reading order wants a heading.
- The assistant window ("What these signals may mean") repeats the card's
  where-line and its sentence, at y = 937, entirely under the fold.

## On screen but not needed for the selected task

- `.feed-open` "Open calculation and explanation →" inside the selected
  row: the calculation is already open on the right.
- `.feed-members` "Member alerts" disclosure under the selected row (the
  card's isolates list covers the same ground).
- The flow's "All units" mode button and the hidden-unit percentages.
- The map's series select and the legend while the pane is open.
- The whole assistant window: one sentence of value, 192 px of frame.
- The tray button (`#ws-tray-button`) and the Layouts segment while the
  researcher reads: both are set-up controls, not reading controls.
- The dim states are half-wired: `.geo` and `.ug` get `.has-selection`,
  but `.feed` never does (`SignalFeed.tsx` ignores `hasSelection`), so the
  12 unrelated rows keep full ink, and no row carries `.is-kin`. The
  dimming CSS in `SignalFeed.css` is dead code today.

## What is stiff: every state change that snaps

| State change | Element | Today |
|---|---|---|
| County pane opens / closes | `.geo-detail` | mounts and unmounts; `transition: all` default, no transform, no opacity |
| Feed row opens its details | `.feed-row` selected content (`.feed-summary`, `.feed-evidence`, `.feed-owner`, `.feed-row-bottom`, `.feed-open`) | conditional render; the row jumps from 56 px to 187 px and the list below leaps |
| Flow nodes dim | `.ug-node` opacity 1 → 0.7 | no transition (`all` default) |
| Window raised on click | `.ws-win` | DOM reorder, no visual change on a non-overlapping grid; swallows button clicks (the smoke failure) |
| Layout preset applied | `.ws-win` transform / width / height | eases 180 ms `ease-out`, hard-coded, not `--mo-*`; the window bodies inside snap to the new width |
| Card switches incident | `.sig-body` | enters with `sig-enter` 320 ms; the old body vanishes instantly (no leave phase, `is-leaving` is never applied) |
| Kind chips, segment buttons, Layouts | `.seg button`, `.feed-kinds button` | colour snaps |
| Map series change | `.geo-county` fill | eases (good) |
| "Found so far" tiles | `.tl-ev` | enter animation exists (good) |
| First paint | windows | `data-animate` gates the window transitions (good) |

## Prioritised fixes

1. **Card primacy and reading order.** When a signal is selected the card
   window gets the accent ring (2 px `--live`, 2 px white gap, like every
   other selected element on the page) and a soft shadow; the map and the
   flow are its "answer" windows and stay at full tone; the list, the
   assistant and the grid step back (lighter frame). Every window opens
   with one 12 px line that says what it answers for the selected signal
   ("Where Internal medicine A's patients come from and go next").
2. **Focus mode.** One control on the card's chrome and the `F` key
   enlarge the selected window to the full board width and the viewport
   height, collapse the other windows to a rail of their titles (click one
   to focus it instead), and restore with the same control, `Esc`, or
   "Show all windows". It is one more layout derived from the user's own,
   which stays untouched.
3. **Wire the feed's dim state** (`has-selection`, `is-kin` by unit) so the
   list steps back like the other panels.
4. **County pane slides in from the right and fades**, and leaves the same
   way (`transform` + `opacity`, `--mo-3`, `--mo-ease`), kept mounted for
   the exit; nothing under reduced motion.
5. **Feed row details ease open** (`grid-template-rows` 0fr → 1fr).
6. **Flow nodes ease their opacity**; window size changes use `--mo-2`.
7. **Fix the swallowed close click**: render windows in a stable DOM order
   and express z-order with `z-index` only.
8. Later: hide `.feed-open` when the card is visible; let the assistant
   fold into the card as a "What it may mean" disclosure; move Layouts
   into the tray.
