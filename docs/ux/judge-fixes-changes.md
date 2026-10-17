# Branch `ux/judge-fixes`: every change

Built after Gemini's review of judge Samuli Niiranen's two sentences ("UI elements and graphs are quite cluttered / hard-to-read / small at places"; "how could the user even quicker access the results of a specific query of interest?") was checked against the code. Eleven commits ahead of `ux/usability-loop`, 69 files. Runs at http://localhost:5190 beside the base at http://localhost:5181. Typecheck, lint (one pre-existing warning) and 270 tests pass.

## What the user sees

### Finding an answer
- **Compound search.** "urology e. coli", "icu blood severe meropenem", "med-a esbl", "pyelonephritis uro" return results. The top result opens the doctor's list or the signals pre-filled (unit, specimen, syndrome, severity, drug, organism, phenotype).
- **A drug or an organism carries into the view.** "meropenem" opens the doctor's list with meropenem's row selected and scrolled into view; "klebsiella" highlights that organism in the unit context. Before, both landed on the default case.
- **Deep links survive.** A doctor link into a board that was already open keeps its parameters (the board's hash write used to wipe them) and opens the coverage window instead of leaving the saved layout as it was.
- **The hand points at the answer.** After a search result or a question chip, the drawn hand glides to the answer: the selected drug row, the highlighted organism, the doctor's headline, the Summary window, or the first window. No lock, no clicks taken; it fades after a second.
- **"Treat a patient" in the sidebar**, right under Home. One click to the doctor's list from anywhere.

### The doctor's list
- **Last 28 days beside the year on every row.** "last 28 d: 36 of 45 (80 %)"; the percentage only from 30 results; an em dash for drug pairs. The annual share keeps the bar, standing and order. No flag or arrow (decision D-044 B10 kept).
- **The 4 weeks / 1 year toggle is gone.** The list is always the annual ranking; the 28-day column header carries the old caption (unit only, all organisms, context).
- **The answer states its data.** Under the headline: "Results up to 12 May 2025, the last 365 days, Urology."
- The print sheet and the first-choice rows carry the 28-day value too.

### The Signal window
- **Plain words first.** The sentence in plain language stands open under the numbers; the method (name, formula, constants, code tabs) is one closed fold below it.
- **No decision codes on screen.** D-020, D-042, D-063 are gone from the card; they remain in Copy citation.

### The workspace
- **Floating bottom-left buttons removed.** Add a window, Tools and Filter sit in the toolbar. Narrow screens keep one Add button at the top.
- **Filters in the toolbar.** Unit, phenotype and kind moved from the signal list's header popover to one Filter button in the toolbar; the list keeps its removable chips.
- **Map and Graph open six columns wide** (were three or four). Old saved layouts rebuild.
- **One heading size for every window.** Notebook, Signals, Map, Patient flow and the rest read as sections of the same desk; each had its own size before.

### Demos and the start page
- **A demo fills itself in once.** The first time each demo opens in a browser. Settings has "Demo files fill themselves in: the first time / every time / never". Later opens show the hand pointing at the first window, with no lock and no tour offer.
- **Replay** (from the main branch, merged): a replay button next to each demo in the sidebar always fills, from an empty notebook.
- **Start page centred** on wide screens; the four demo cards share the row; no automatic tour popup on a first visit (the "Take the tour" card and sidebar entry remain).

### Merged from the main working branch (uncommitted there at the time)
- Add-a-window names lead with the window's title, then what it shows.
- Patient flow: repeated numbers removed, clearer column heads and info text.
- Tools: the method line under each result removed (the Method block has it); no duplicate method or Copy in the notebook.
- Timeline, map and county detail tweaks.

## Commits, oldest first

| Commit | Change |
|---|---|
| c6cfc7b | Sidebar: Treat a patient under Home |
| 7505404 | Doctor list: 28 days beside the year; toggle removed; print sheet and first-choice rows |
| d700e6b | Signal window: plain words open, method folded, no decision codes |
| a521acd | Compound search; drug and organism hits carry parameters |
| cd69ba4 | Floating buttons gone; Add a window and Tools in the toolbar; Map and Graph six columns |
| ce93bd3 | Signal filters in the toolbar |
| ad5ccdc | Doctor links into an open board keep `cov.*` and open the coverage window |
| c24e0a5 | Fill once per demo; Settings control; pointing hand on later opens |
| 0795f43 | Usability loop log, loops 9 to 13 |
| 1b3a7ea | Hand points at the answer after a question; answer states its data; one heading size; start page centred; no tour popup |
| c6fcf46 | Merge of the main working branch's uncommitted work; replay always fills |

## Files that matter

- Search: `apps/web/src/components/command/match.ts`, `CommandField.tsx`; `doctor/filters.ts`, `doctor/CoverageWindow.tsx`, `doctor/UnitContext.tsx`
- Doctor list: `doctor/CoverageList.tsx`, `RecordStrip.tsx`, `DoctorAnswer.tsx`, `PrintSheet.tsx`, `Details.tsx`
- Signal: `research/math/AlertMath.tsx`
- Workspace: `research/workspace/Workspace.tsx`, `layout.ts`, `workspace.css`; `research/BoardFilters.tsx`, `ResearchBoard.tsx`, `SignalFeed.tsx`
- Shell and start: `shell/Sidebar.tsx`, `start/start.css`, `components/Settings.tsx`, `App.tsx`
- Demo: `demo/Pointer.tsx` (new), `demo/openDemo.ts`, `demo/perform/*`
- Text: `libs/utils/i18n/src/en.ts`, `fi.ts`, `surfaces/command.ts`, `doctor.ts`, `board.ts`, `map.ts`, `network.ts`, `tools.ts`

## Not done or not checked

- A drug searched alone lands on the default case (mild, urine), where that drug may not be a row: meropenem is not offered for mild cystitis, so nothing is selected.
- The one project-less view tab keeps one layout for both the patient view and the research view; the branch opens the coverage window on a doctor link but does not reset the rest.
- The `period` field in `doctor/filters.ts` is dead now that the toggle is gone; removing it is a follow-up.
- `Workspace.tsx` has a pre-existing `useExhaustiveDependencies` lint warning.
- Nothing merged back to `ux/usability-loop` or `main`; no real user has tried it.
