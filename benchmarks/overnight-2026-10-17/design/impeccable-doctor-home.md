# Impeccable pass: doctor page and home (D-008)

Audited at 1280x860 and phone width from the shoot.mjs shots (label wip-imp, deleted after). Files owned: components/doctor/*, components/home/*, i18n doctor.ts and home.ts (the latter two untouched).

## Audit

Strengths: flat white panels, one accent, four-size type scale, tabular numbers, S/R and standing never by colour alone (glyph plus word), wording rules intact.

Findings and action:

1. Home: card inside card (the since panel wrapped three bordered tiles). Fixed: panel border and fill removed, the tiles are the panels, heading sits above on the page ground.
2. Home: offline note used a 3 px coloured left border (anti-pattern). Fixed: full 1 px border, watch tint fill.
3. Home: tiles aligned their content centred, so a wrapped label shifted the numbers on phone. Fixed: top-aligned, 96 px min height, tile radius 10 like other panels.
4. Home: no explicit focus ring on stat tiles and role links. Fixed: 2 px accent ring, offset 2.
5. Doctor forest plot: long names (piperasilliini-tatsobaktaami) wrapped to two lines in a 36 px row at laptop. Fixed: name column 140 to 230 px; fits on one line.
6. Doctor: selected row used a 3 px inset left bar (anti-pattern). Fixed: accent-soft fill plus 1 px accent-line ring.
7. Doctor: point marker 8 px was light against the 4 px interval; raised to 10 px so the forest plot carries more weight than the side panels.
8. Doctor phone: tier chip stacked under the name, rows 88 px tall; names broke mid-word ("siprofloksasii-ni"). Fixed: chip inline, wraps below only when needed, `overflow-wrap: break-word` with hyphens, name column 1.9fr, rows min 44 px.

Not changed (noted): the details pane sits cut at the bottom of the right column at 860 px (it scrolls inside the column, by design); right-column panel titles are 12 px grey, adequate contrast (ink-3 4.7:1); the first group has no "clears the bar" divider (the header carries "raja"); biome noImportantStyles warnings are in the print block only.

## Verification

Before shots read for home and doctor, laptop and phone. After: home laptop and phone, doctor laptop read and fine. The doctor phone re-shot after the last edit (name wrapping) came back blank twice: the dev server was serving a broken module (other agents' in-progress files components/hero/WeeklyBand.tsx and Timeline.tsx fail typecheck: missing `fmtVal`, `layers`), so that last phone edit is verified by CSS reasoning only; re-shoot once hero compiles.

Checks: biome shows errors only in files not mine (hero/*, research/workspace/Workspace.tsx parse error, RegionalMap, layers.ts); pnpm typecheck fails only in hero/WeeklyBand.tsx and Timeline.tsx; pnpm test:ts 179 of 179 pass.
