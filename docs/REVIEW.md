# Review: usability and suitability, 2026-10-17

Written after the pre-submission feedback from a judge (see
JUDGE-FEEDBACK.md). The judge said the project-based approach is an
interesting choice with certain strengths, that the UI elements and graphs
are cluttered, hard to read or small in places, and asked how a user could
reach the results of a specific query of interest even faster.

Judging weighs four criteria equally (CONTEXT.md): understanding of the
challenge, suitability of the solution, usability, and detecting deviations
and anomalies. Understanding and anomaly detection are the strong ones.
Usability is where we lose the most. Suitability is good but not strong, for
the reasons below.

## Basic principles we're breaking

- **Visual hierarchy and focus.** Many windows open at once, all the same
  weight, so nothing says "look here first".
- **Cognitive load and Hick's law.** Layouts, "+ Add a window", Tools,
  Windows, the sidebar, click-to-add and the edge "+" are six ways to do two
  things.
- **Recognition over recall.** "ESBL 3/0.2", "MRSA new", "n", "%R" and
  "profile" are our shorthand. The judge already flagged these.
- **Legibility.** Small type and small graphs inside small windows. This is
  the "cluttered / small" comment.
- **Task-first, not tool-first.** The screen shows windows and tools. A
  person arrives with a question ("is something rising on my ward?") and has
  to build the answer.
- **Progressive disclosure.** Everything is shown up front; detail should
  wait until asked for.
- **Discoverability.** The "+" on frame edges and between windows only
  appears on hover, and most people never find it.

## Why it feels clunky

We gave users a window manager. Arranging boxes is work, and it is work that
isn't about the user's question. Free-form windows suit a researcher with an
hour to spare, not a judge with three minutes. The fade-in animations added
on 2026-10-17 also add a little waiting to every screen.

## What we're missing

1. **A default answer view per role.** One screen that answers the role's
   first question, with a single headline result and the rest behind it. The
   demo files are the start of this, but they still open as a pile of
   windows.
2. **A direct path to a specific result.** Something like a question box that
   jumps to the matching result. That is the judge's second point.
3. **A minimum text size and a cut in what opens by default.** Fewer windows,
   larger graphs.
4. **Plain labels.** Replace the shorthand or explain it where it appears.
5. **A test with someone outside the team.** Two people, five minutes each,
   saying what they would click first.

## Suitability to the challenge: good, not strong

The brief asks how the right resistance information reaches the right
clinician, at the moment of the decision, in a form they trust and can act
on. We cover the first half well (continuous HL7 feed with THL's codes, data
checks on every batch, several hospitals, projects, reproducible cuts) and
the second half only partly.

### Why not strong

- **Reaching the clinician.** The alerts show up inside the app.
  deploy/integration.md says they would be pushed to infection control in
  tools they already use, such as the patient record's task list or e-mail.
  That is a design note, not something built or demonstrated. A clinician who
  isn't looking at the app gets nothing.
- **At the moment of the decision.** The doctor's coverage list is now one
  window among many in a project. The bedside path is longer than it was, and
  the judge's feedback about reaching a specific result quickly points at the
  same gap.
- **A form they trust.** There are "how we calculate it" blocks, but the
  judge still found "ESBL 3/0.2" and "%R" confusing. Trust needs numbers a
  clinician reads without help.
- **Evidence it works for real users.**
  - Our results are measured on synthetic data.
  - We are not aware of a clinician or infection-control nurse having used
    it (checked in the repository only; there may be use outside it).
  - A judge can't tell whether the "right clinician" actually gets what they
    need.
- **Balance.** Much of the recent work (notebooks, windows, export) serves
  the researcher. The doctor and the infection-control nurse, the people the
  brief is about, got less.

## Order of work

1. Make each demo file open on one focused screen with a headline answer.
2. Add a question-to-result entry on the start page.
3. Larger defaults and a type-size floor; fewer windows open at first.
4. Plain labels for the shorthand above.
5. Two outside tests before submission.
