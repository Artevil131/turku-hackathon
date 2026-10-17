# What overwhelms a new user on the researcher screen

Claude Code, 2026-10-17. Screen: project "ESBL cluster on Internal medicine A",
1440x900, all windows open. No code changed. Counts are from the screen
description and the code (`Timeline.tsx`, `hero/WeeklyBand.tsx`,
`research/notebook/Notebook.tsx`); window and chip counts are approximate.

## 1. What overwhelms, ranked

1. **The answer comes second (hierarchy).** The Summary ("Possible cluster: 7 ESBL
   isolates ... about 1.4 expected") sits under a timeline window that fills the
   first screen. The eye lands on a 9-lane chart and about 15 controls first.
2. **About 90 clickable controls before counting pills (density, Hick's law).**
   Toolbar 6, rail 4, timeline about 15, 4 tiles plus "15 more", Summary 2,
   window chrome 15 (i, expand, close on each of 5), notebook about 17 (grip,
   collapse and remove per cell, plus the "+" between cells), list chips, 2
   floating pills, about 8 in the sidebar.
3. **One signal shown in 5 places (repetition).** The MED-A ESBL cluster is a
   band pill, a tile in "Signals since 2.10.2023", the Summary, a row in the
   Signals list, and the notebook's timeline cell, which draws a second band.
   The user can't tell whether these are 5 findings or 1.
4. **Shorthand without units (jargon).** "ESBL 7 · 1.4", "samples 39 · 70",
   "MRSA new", "cultures/wk, own scale", "observed · usual", "PHC-N", "slice",
   "cell". The judge flagged the same kind of text before (JUDGE-FEEDBACK §4).
5. **Controls that compete (one task, many routes).** There are two
   "+ Add a window" buttons, Layouts and Tools. Time is moved four ways: play,
   step, Speed, and Jump to a date with Go.
6. **Type too small to read (legibility).** Pill text is 10 px and range labels
   9.5 px (`WeeklyBand.css` 178, 261), under the 12 px floor in `styles.css`.
   The screen uses at least 7 sizes (9.5, 10, 13, 14, 16, 22, the large date).

## 2. What is missing

- **What the project is for.** Add one line under the title: "Question: is
  there an ESBL cluster on Internal medicine A, and since when?"
- **Where to start reading.** Number the windows or give the Summary a heavier
  frame and put it first.
- **What to do next.** The Summary's two buttons explore the data. Add one
  action that settles the case: "Mark reviewed / Tell the ward / Export".
- **Status of a signal.** Show which of the 19 are new, seen or closed. Today
  all look alike.
- **A way to ask in the project.** The question box is only on the start page.
  Add it to the toolbar, scoped to this project.
- **Feedback after a click.** A pill selects its signal without moving the
  clock. Add a short line: "Selected: ESBL MED-A, 5.5.2025. Clock unchanged."
- **What "Data checks passed" covers.** Add the count and date: "N results
  checked, last batch 12.5.2025."

## 3. Five cheapest cuts

1. **Merge** the timeline's 4 signal tiles into the Signals list window
   (the "15 more" link already points there).
2. **Hide** the notebook's timeline cell while the Timeline window is open
   (it is the second band).
3. **Merge** the toolbar "+ Add a window" and the Layouts row into the floating
   pill (one route to add or arrange).
4. **Hide** Step, Speed and Jump to a date behind the big date (click the date
   to get them). Leave play visible.
5. **Hide** the i, expand and close buttons on each window until hover or
   focus (removes 15 icons from a still screen).

## 4. Do not touch

The Summary's content: one sentence, Seen 7 against Usual 1.4. It gives the
result in plain words with its baseline, and it is the only window a first-time
viewer understands without help. Move it to the top; do not change it.
