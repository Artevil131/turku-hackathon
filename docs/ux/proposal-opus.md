# UX proposal: Answers first, Workspace second

Claude Code (Opus), 2026-10-17. Based on the code on `research/unified-main`.

## 1. Three biggest problems

**A. The doctor's answer sits inside a window manager.** *Breaks: one path per task, progressive disclosure.*
- Three ways in: the Doctor demo (a project with a timeline, `demos.ts`), "Treat a patient" (`templates.ts`), and a start-page chip.
- `CoverageWindow.tsx` shows answer, list, `UnitContext`, `PatientPanel`, `Details` and `FailsTogether` at once.
- The doctor's tour teaches "Add a window" and statistics (`tourClin.ts`).

**B. Too many ways to do two things.** *Breaks: Hick's law, visual hierarchy.*
- The start page offers 10+ actions before any answer, plus a mock "Shared with me".
- The sidebar repeats the demos and the tour.
- The workspace adds windows five ways (two buttons, hover "+", empty-board click, tray), plus 5 layout presets.
- The role preset is dead: D-065's "Start as" picker is gone and `storedAudience()` always returns `control`, so the doctor's comfortable density never applies.

**C. The ask box finds names, not answers.** *Breaks: match the user's words, shortest path.*
`match.ts` returns one ward, organism or phenotype per result. "ESBL on MED-A, last 4 weeks" cannot be asked, and the 3 chips are hard-coded. This is the judge's "faster to a specific result".

## 2. Information architecture

- **First screen, "What do you need?":** three doors, *Choose an antibiotic*, *Is anything rising?*, *Open my research*; under them, the ask box and recent projects.
- **Level 1, Answers:** full screen, one card, no windows. Same action row on every card: **E** evidence, **C** copy, **P** print/send (`PrintSheet.tsx` exists), **W** open in Workspace.
- **Level 2, Workspace:** today's board.
- **Between them:** W creates a project with the answer's scope; such a project's toolbar starts with "← Answer: …". Breadcrumb: `Answers / Choose an antibiotic`.
- **Starts:** doctor at the questions; infection control at the Watch answer; researcher at the last project or the researcher role template.

## 3. Doctor flow

One screen, defaults filled in, so a returning doctor just presses Enter.

1. **What infection?** Syndrome chips from `@aei/guideline`, grouped Urine / Blood / Wound. Default: the last choice, first time "Acute cystitis in a woman". It sets sample, severity and onset.
2. **Which ward?** Default: last ward (`aei.unit`), else MED-A.
3. **How ill?** Not severely / Severely, default from the syndrome. Toggle "Started in hospital (day 3+)", off.
4. **Enter:** "Most likely to cover: X, 94 % of 412 isolates"; then the others that clear the bar, then those that do not; one disclaimer.
5. **E:** patient ID, sex, age, period, forest plot, ward signals.
6. **Esc:** back to the questions, answers kept.

## 4. Templates

A project = one format + one role.

- **Format** (which windows): Blank, Outbreak, Antibiogram, Regional. "Treat a patient" becomes an Answer.
- **Role** (starter notebook content). Demo files are role templates filled in.

| Role template | Pre-filled | User fills |
|---|---|---|
| Doctor: *Ward empiric review* | Last ward; 365- and 28-day slices; note "For ___ on ___: first line ___; changed ___; action ___" | Syndrome, blanks |
| Infection control: *Weekly ward watch* | 28-day slice, all phenotypes; checklist: signals reviewed, isolates confirmed, precautions, ward told, next review | Ward, owner, ticks |
| Researcher: *Frozen question* | Frozen today; cells Question, Slice, Method (empty), Result, Limits; one code cell | Question, slice, method |

Method stays empty: choosing it is the team's call.

## 5. Delete or hide

- "Shared with me" (amend D-065).
- Demos and tour in the sidebar.
- Layout presets, the toolbar "Add a window", the hover "+".
- "Customise" on each template card.
- `UnitContext`, `PatientPanel`, `FailsTogether` from the doctor's first view (behind E).
- The timeline in the doctor demo.
- The doctor tour's Add, Math and Tools steps.
- The invisible role preset: show its picker or remove it.

## 6. Build order (about an hour each)

1. **Doors and cuts on the start page:** `StartPage.tsx`, `start.css`, `Sidebar.tsx`, start strings.
2. **Doctor Answer screen** (`quick=patient` without `Workspace`): new `answers/AntibioticAnswer.tsx`, `App.tsx`; reuses `SyndromePicker`, `DoctorAnswer`, `filters.ts`.
3. **Action row and keys E/C/P/W/Esc** (E mounts `CoverageWindow`, W calls `launchTemplate`): `DoctorAnswer.tsx`, `shell/launch.ts`.
4. **Watch answer:** `AnswerWindow.tsx`, `answer.css` full screen, same row.
5. **Workspace cuts and "← Answer":** `Workspace.tsx`, `workspace.css`.
6. **Format/role split and tours:** `templates.ts`, `demos.ts`, `NewProjectDialog.tsx`, `tourClin.ts`, `steps.ts`.

## 7. Risks

1. **"Most likely to cover" can read as a prescription** (CONTEXT Q6), and the ICU never reaches 30 isolates. Show n and the bar beside the name, say when a filter was dropped (D-047), and agree the wording as a team.
2. **A half-done split leaves four doctor entries** and breaks tour selectors and tests (`doctor.test.tsx`, `templates.test.ts`). Ship 2 and 3 together or not at all; keep `CoverageWindow` unchanged as the evidence.
