# apps/web

The website (React + Vite, D-003). A thin layer over `libs/utils`; see
../README.md.

    pnpm dev        # API and web together; open http://localhost:5173

Pages (URL hash):

- **Home** (`/`): resistant finds of the last 28 days and the role choice.
- **Doctor** (`#doctor`): patient form (unit, infection site, organism by
  how common it is here), antibiotics ranked by % susceptible with the
  isolate count, a drawer with monthly history, and "what is going around":
  units that send patients here, resistant finds by unit, organisms by how
  many units and home regions they appear in. When four weeks has too few
  isolates the 12-month figure is shown, tagged (provisional, CONTEXT.md Q7).
- **Research** (`#research`): signals (resistant finds as they arrive, with
  where those patients go next and the same patient's other finds),
  antibiogram grid, monthly trends per antibiotic, unit relations map.
- **Settings** (`#settings`): language, remembered view, about the data.

Real data: resistant finds, organism and region counts, patient flows
(`src/relations.ts`). Example data, labelled in the UI: resistance
percentages and their history (`src/examples.ts`), until the counting
method is decided.

Design: Impeccable (D-008). Product context in /PRODUCT.md, the direction
contract in `.impeccable/surfaces/`. Light mode only for now; dark tokens
stay in `src/styles.css` under `[data-theme="dark"]` (`THEME` in `App.tsx`).

## Optional assistant

When `/api/meta` reports `ai: true`, Doctor and Research offer a bilingual
Ask field. Parsed filters appear as removable chips; sex, inclusive age
bounds and dates are carried through to the isolate request. Unrecognised
words remain visible. The field hides on 503 and a 502 leaves manual
filters available. Requests are refreshed on replay-clock changes; stale
responses cannot replace newer data.

The incumbent antibiograms and history use invented example figures, not
an isolate-backed statistics pipeline. An active question therefore shows
an exact-selection results table instead of those example percentages or
history. Counts reuse `@aei/counting` first-isolate deduplication, grouped
by organism/specimen/antibiotic; the existing reporting floor still applies.
It makes no annual fallback or comparison beyond the requested records.
Clearing the question restores the ordinary example views. Research signals
continue through their existing finding list, populated from matched records.

Released CPE/carrier alerts have an inline Explain action, including without
an LLM. Template responses are explicitly marked; explanations reload when
the language changes. The model never supplies a susceptibility count.
