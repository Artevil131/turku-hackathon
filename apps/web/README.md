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
