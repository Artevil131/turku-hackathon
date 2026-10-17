# Impeccable pass: researcher surface and timeline band

Viewed at 1280 (laptop shots, before and after) and the 390 phone shot; 1440 by CSS reasoning only (the grid is fluid).

## Audit
- Hierarchy: panel titles were 15 px but weight 600 in some panels and 650 in network, unit grid and map; unified at 600.
- Spacing: panels padded 12 px (feed, geo, assistant, math) or 14 px (network, unit grid, map); unified at 12 px.
- Close mark: only feed and math heads cleared the x (32 px right padding); network, geo, unit graph, unit grid, map and assistant heads could sit under it on hover. Added 24 px right padding on those heads.
- Assistant text: 13 px at 1.45 with unbounded line length; now 1.55, max 64ch, full ink colour, 10/12 px card padding.
- Band: flat white on white; pills had no lift against the stream and lane lines competed with the pills. Added a faint accent-tinted gradient and soft shadow on the band, a 1 px drop shadow under pills, lane lines at 40 % opacity. Text sizes (11 px SVG) and contrast (white on --st-alert, --ink-2, --brand-accent; ink on dashed data pills) unchanged and pass AA.
- Targets and focus: controls are 28 px (existing token), focus outlines present on feed, close mark, handle, pills; not changed.

## Changes (CSS only, no behaviour)
research/HospitalNetwork.css, RegionalMap.css, UnitGrid.css (padding, weight), research/assistant/assistant.css, research/workspace/workspace.css (head clearance, close mark hairline), timeline.css (band background and shadow), hero/WeeklyBand.css (lane lines, pill shadow).

## Not done
Phone true-width not checked in a real browser; the in-app browser pane did not render the research board, so the 1440 and hover states (x, grip) were not looked at.
