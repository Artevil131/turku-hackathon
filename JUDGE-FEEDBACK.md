# Judge feedback, 2026-10-17: points to work on

Written after the presentation, not yet acted on. Nothing here is fixed yet.
Each point says what the judge said, what we saw in the researcher view, and
what would need to change. Where we have not checked the code, that is said.

## 1. Explain what the map is

- The judge did not know what the map shows.
- In the screenshot the map is a stack of rows (ED, MED-A, MED-B, SURG, URO,
  ICU, GER, PHC-N, PHC-S) with a dark bar per row, plus a "profile" track and
  a 0 to 12 scale at the top. There is no legend or caption on the screen
  saying what a bar, a shape or the scale means.
- To do: add a one-line caption and a legend on the map. Say what the unit is
  (a ward, a count per day?), what the bar height and width encode, and what
  the scale 0 to 12 counts.

## 2. Connect the Finnish map with the hospital timeline

- The judge wants the national signal (the Finnish map) and the hospital
  timeline to be linked, so a signal seen in one can be found in the other.
- A colleague is working on the connections, and there are many hospitals.
- To do: agree how a hospital is identified on both views (one shared ID or
  name list), and decide what a click on one view does in the other.
  Coordinate with the colleague before changing either view.

## 3. Make the researcher page more interactive

- Keep what works: the current UI is good and the judge did not ask to
  replace it.
- Make the parts work together, so one signal can be seen from several
  angles, and filters can be stacked on one signal.
- Explain each signal better: what it is, when it fired, why.
- To do: a "signal" view that links the timeline, the map, the alert list
  and the filters, so selecting one updates the others.

## 4. Explain the numbers and abbreviations

- The judge found some numbers and abbreviations confusing (for example
  "ESBL 3/0.2", "MRSA new", "samples", "profile", "n", "%R") and did not
  always understand how a figure was calculated.
- To do: a short "how this is calculated" text for each signal, next to the
  signal, in plain words. Spell out abbreviations on first use. Agree the
  wording with the team, since the calculations are in the detectors and
  alerts code (libs/utils/detect, libs/utils/alerts).

## 5. Finding the four events was hard

- In the presentation the judge had trouble finding the four events. The
  presenter had to hunt for them.
- The timeline shows a play button, a step control ("1 day / 2 s"), a date
  (12.5.2025) and a "Data checks passed" tick, but no list of the events.
- To do: add a summary panel listing the four events with date, unit,
  signal type, and a link that jumps the timeline to that date.

## 6. Step size control is hard to find

- The judge could not see how to change the size of a step through time.
- In the screenshot the step size is a dropdown "1 day / 2 s", next to the
  play and skip buttons. It is easy to miss, and "1 day / 2 s" is not
  explained (one simulated day per two seconds of playback).
- To do: make the control clearer (a label such as "Step: 1 day" and
  "Speed: 2 s per step"), and check whether the options are enough.
  Not yet checked in the code.

## Open questions for the team

- Which unit does the map use (ward, hospital, region), and is that stated?
- Which hospital ID links the Finnish map to the hospital timeline?
- Do the four events need to be fixed in the demo data, or found by the
  detectors live?
