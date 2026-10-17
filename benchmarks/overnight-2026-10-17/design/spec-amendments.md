# Amendments to spec-doctor.md and spec-research.md (orchestrator, 01:50)

These override the two specs where they differ. Sources: Artem's addendum
of 01:15, AUDIENCE.md section 1, AGENTS.md (no unrecorded statistical
choices), and what the orchestrator already built.

## Doctor's list

1. **The doctor types nothing.** No organism input, no age number entry,
   no free text. Drop the "Suspected organism" chip and its flags-by-
   suspected-organism logic. The record strip is a row of one-click
   filters, each with its default already selected:
   - Unit: preset from `aei.unit` (remembered), a select-like chip.
   - Specimen: urine (default) / blood / wound → `?specimen=`.
   - Sex: any (default) / F / M → `?sex=`.
   - Age group: any (default) / child 0–17 / adult 18–64 / older 65+ /
     very old 80+ (the fixed table of D-019). **Not applied to the figures:
     the coverage API has no age filter.** The chip carries a visible tag
     "not applied yet" / "ei vielä käytössä" when a group other than "any"
     is chosen, and the list header says so too. Never alters the list.
   - Inpatient day 3 or later: off (default) / on. **Not applied to the
     figures** for the same reason, same tag. It does NOT change severity:
     whether hospital onset means the 90 % bar is undecided (ENGINE 2.6,
     gap G5).
   - Severity: mild, 80 % bar (default) / severe, 90 % bar → `?severity=`.
   - Period: last year (default, D-023) / last four weeks → `?windowDays=`
     365 or 28. AUDIENCE.md section 1 lists it as a doctor filter.
2. **Likely organisms replace the organism input**: a block above or
   beside the list, from `coverage.organisms[]` (name, isolates, share),
   titled "Likely organisms in {specimen} on {unit}" with level and n.
   For each antibiotic row, the expanded view (and a compact line in the
   row when relevant) says which of the top organisms it does not cover:
   from `notCovering[]`, `outsideSpectrum[]`, `untested[]`, as text with
   their pool shares. No re-ranking.
3. **Certainty badge without invented cut-offs.** The n ≥ 100 rule in the
   spec is not in DECISIONS.md, so do not implement it. The badge states
   the level reached, which D-023/D-033 already define: "own unit data" /
   "similar units' data (unit had too few)" / "whole hospital (unit and
   similar units had too few)", with a distinct glyph per level, plus n
   and the interval width in points ("±{w} pts"). Write `certaintyOf` as a
   pure lookup on `coverage.level`.
4. **Unit preset means zero input.** Opening `#doctor` shows the list for
   the remembered unit with all defaults; U1 is one click from home.
   Doctor URL state: `#doctor?unit=URO&site=urine&sex=F&age=older&onset=1&sev=severe&period=28`
   using `writeHashParams`/`hashParams` from `apps/web/src/url.ts`; the
   unit also stays in `aei.unit`.
5. **Ask field**: keep the existing `Ask` (when `ai` is true) out of the
   doctor page for now; it returns in item 5 of the brief.
6. Copy goes into `libs/utils/i18n/src/surfaces/doctor.ts` only (prefix
   keys `dr`), not en.ts/fi.ts.
7. Use `AsOf` (`apps/web/src/components/AsOf.tsx`) in the list header and
   in the likely-organisms block.

## Researcher's board

1. The shell exists: `apps/web/src/components/research/ResearchBoard.tsx`
   (feed left, one panel right, tabs under 1100 px, URL state). Shared
   types and `kindOf` are in `research/board.ts`; panels receive
   `PanelProps` / `FeedProps` from there and change shared state only
   through `onChange`. Do not edit the shell or board.ts; ask the
   orchestrator.
2. Regional map polygons come from the API: `client.counties()`
   (`GET /api/counties`, D-043, already live). Do not copy the GeoJSON into
   `public/`. 404 → the panel says the server has no county geometry.
3. Copy per panel in its own file: feed → `surfaces/feed.ts` (prefix
   `feed`), grid → `surfaces/grid.ts` (`grid`), network →
   `surfaces/network.ts` (`net`), map → `surfaces/map.ts` (`map`). Keys
   the spec lists without a prefix get the prefix.
4. Every panel header carries its title and `AsOf` in one element (U3).
5. Severity (R1) and first step (R2): keep the spec's handling (no
   severity word; first step as a per-kind template labelled "template").
