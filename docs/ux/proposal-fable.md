# UX proposal (Fable), 2026-10-17 evening

Independent review of `apps/web` as the code is tonight. No code changed.

## 1. Three biggest usability problems

**1. The doctor still gets the whole lab.** `CoverageWindow.tsx` renders the
answer card, then `SyndromePicker`, `RecordStrip` (8 control groups), the
forest plot, `UnitContext` (ladder, organisms, signals) and `Details`, inside
a `Workspace` frame with close, focus and ⓘ buttons; the `ws-float-bar`
("+ Add a window", "Tools") renders unconditionally (`Workspace.tsx` ~922),
even for `quick=patient`. Breaks progressive disclosure. This is the judge's
"reach a specific result faster".

**2. One start page, six ways in.** `StartPage.tsx`: two heading buttons; a
question box whose field opens the entity search (`CommandField`) while its
three chips go three different places; Recent; Demo files; five template
cards × 2 buttons; "Shared with me" placeholders that admit sharing is not
connected. The sidebar repeats Demo files and New. A 65-step tour auto-starts
on first visit (`App.tsx` 141). Breaks Hick's law: no primary action.

**3. Every window has the same weight, in 12 px chrome.** `templates.ts` and
`demos.ts` open Summary (9 rows) over three 40-row windows plus a 10-cell
notebook. `workspace.css` uses `--t-xs` (12 px) in 12 places,
`CoverageList.css` `--d-xs` in 15. Template names mix formats (Blank,
Regional) with tasks (Treat a patient). Breaks visual hierarchy.

## 2. Information architecture

Two levels, named on screen:

- **Answers**: project-less quick views, no windows, no board chrome. Three
  panels, hotkeys 1/2/3: *Treat* (doctor), *Watch* (infection control: the
  `AnswerWindow` sentence plus my units' open signals), *Search*
  (`CommandField`). Each ends in one action row: **Show the evidence**,
  **Copy**, **Print**.
- **Workspace**: the project board as today.

*Show the evidence* opens a Workspace from the matching format template with
the panel's filters in the hash; that Workspace shows **← Back to the answer**
top-left of the board. Down and up, both labelled.

First screen: "What do you want to know?" (focuses *Search*), three role
tiles (Doctor → Treat; Infection control → Watch; Researcher → Workspace from
the researcher role template), then Recent. Demo files and templates go below
Recent under one heading, "Start from".

## 3. Doctor flow (Treat)

Ward comes from `aei.unit` or the URL; opened from a link with a known ward,
skip to step 4.

1. **Where is the patient?** Ward buttons; default the remembered ward, else
   Internal medicine A.
2. **What sample?** Urine · Blood · Wound (default urine). Under it the
   guide's syndrome chips; one chip also sets severity and onset.
3. **How ill?** Mild · Severe (default mild). **In hospital 3+ days?** No ·
   Yes (default no). Enter, or "Show the answer".
4. **Card** (`DoctorAnswer`): "Start with X. Covers N % of the likely
   bacteria (n …)", Also good enough, Not a first choice, one trust line
   (unit / ward type / hospital glyph, period, date), the disclaimer. Chips
   repeat the three answers; "Change" reopens the step.
5. **Action row**: Show the evidence (forest plot and ladder in a Workspace),
   Copy, Print. Sex, age, period, patient id wait behind "More about the
   patient". Organism is never asked.

## 4. Template model

**Format** (which windows; `OPEN` in `templates.ts`): Blank, Outbreak,
Antibiogram, Regional, Patient. **Role** = a format plus a starter notebook
page (the `page` builder `DemoSpec` already has). Demo files = role templates
filled in.

- *Doctor: Ward handover* (Antibiogram). Pre-filled: note "Week of {date},
  {ward}", checklist "Coverage that changed / Signals here or in feeder units
  / Tell the team". Fills: ward, three lines.
- *Infection control: Weekly watch* (Outbreak). Pre-filled: timeline cell
  (8 weeks), detector cell, note "Signals / Action / Follow up". Fills: slice
  unit and phenotype.
- *Researcher: Study* (frozen). Pre-filled: question note, slice, rate,
  compare with previous period, detector, empty code cell, "Reading" note.
  Fills: question, dates, organism.

## 5. Delete or hide

- "Shared with me"; "Customise…" on every card (keep it in the Project
  menu); the heading's two buttons.
- The auto-started tour; cap every tour at 7 steps.
- Layout Presets in the toolbar, the hover edge "+" and the click-on-board
  picker (`findHint`, `onAreaClick`): keep one "+ Add a window".
- All board chrome in quick views. The sidebar's Demo files section.
- The three chips' three destinations: all go to Answers.

## 6. Build order (~1 h each)

1. Doctor asks first: new `doctor/DoctorAsk.tsx`, shown by
   `CoverageWindow.tsx` when no `cov.*` is in the hash; action row in
   `DoctorAnswer.tsx`; copy in `i18n/surfaces/doctor.ts`.
2. Quick views without chrome: `plain` prop on `Workspace.tsx`, set from
   `App.tsx` when `quick` is in the hash; `workspace.css`.
3. Start page cut and role tiles: `StartPage.tsx`, `start.css`, `start.ts`.
4. Watch panel and the bridge: "watch" in `QUICK_STARTS` (`templates.ts`),
   `openView("watch")` in `App.tsx`, `tabName` in `Sidebar.tsx`, "Back to
   the answer" in `ResearchBoard.tsx`.
5. Role templates: `ROLE_TEMPLATES` with page builders shared with
   `demos.ts`; `launch.ts` creates the page as `openDemo.ts` does.
6. Tour diet and type floor: `App.tsx` 141, `tour/steps.ts`; `--t-xs` only
   on hover chrome in `workspace.css`, `CoverageList.css`.

## 7. Two biggest risks

- **The ask step costs a doctor one more click** per open. Ask only when the
  ward is unknown or the view came from Home; links skip it.
- **Two filter namespaces** (`cov.*` for coverage, `unit=`/`ph=` for the
  board): a bridge link carrying the wrong one shows a different case than
  the card just read. `doctor.test.tsx` and `ProjectActions.test.tsx` will
  need updating; budget 20 minutes.
