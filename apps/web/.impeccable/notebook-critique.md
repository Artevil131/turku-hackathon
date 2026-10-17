---
version: 1
slug: "notebook-critique"
primary_target: "apps/web/src/components/research/projects/Reproduce.tsx"
related_targets:
  - "apps/web/src/components/research/projects/reproduce.css"
  - "apps/notebook/build.sh"
  - "apps/notebook/theme/aei-theme.css"
---

# Notebook (JupyterLite) and the Reproduce window, 17 Oct 2026: critique

Method: no browser pass. There is no built JupyterLite on this branch
(`apps/web/public/notebook` does not exist; `apps/notebook/build/` is empty),
and a build needs micromamba to pack the xeus-r environment from conda, plus the
Pyodide CDN. The size of that download is not known from here, so per AGENTS.md
the build was not run. This critique reads the sources (`build.sh`,
`pyproject.toml`, `files/`), the API's `/api/lite/` routes, the dev proxy
(`/notebook/...` in `vite.config.ts`), and the friend's window on
`origin/main` (`projects/Reproduce.tsx`, `projects/reproduce.css`).

## Part 1: the notebook itself (what clashes with the app)

1. **Fonts.** The app's stack is Inter for UI and data and Bricolage Grotesque
   for display (`--font-ui`, `--font-data`, `--font-display`). JupyterLab ships
   its own system stack, so the notebook reads as a different product. The
   theme now sets Inter (see the Inter ignore in `.impeccable/config.json`).
2. **Colour.** JupyterLab's default is grey chrome with a blue brand. Ours is
   a pale ground, flat white panels, one violet accent (`--brand-accent`
   #635bf1), navy ink (`--ink` #07081c). The theme maps these; it is light
   only, so the app's dark mode still meets JupyterLab's light notebook.
3. **Chrome.** Menus, tabs and the file browser carry square corners and grey
   1 px dividers; ours use `--radius-panel` (10 px) and `--line`. The status
   bar is a strip the app does not have (hidden in the theme).
4. **Launcher clutter.** Console, Other (Terminal, Settings) and Text/Markdown
   are offered. A reproduction needs Python and R notebooks and the file
   list. The theme hides Console and Other; the selectors are unverified (see
   Not verified).
5. **Where the project data appears.** The API serves each project as a folder
   (`reproduce.ipynb`, `reproduce-r.ipynb`, data, `datapackage.json`, method
   notes). The file browser shows the project id as the folder name, so the
   user cannot tell which cut the notebook runs on until they read the first
   cell. The Reproduce window's header (part 2) states the project name, the
   language and the cut; the notebook itself does not.

## Part 2: the Reproduce window on main (`projects/Reproduce.tsx`, `reproduce.css`)

What works: the header puts the project name, the Python/R switch and "Open in
a tab" on one line; the empty state gives the project button; the iframe is
positioned over the slot and clipped against scroll containers, so it cannot
cover another window's controls. Focus rings come from the global
`:focus-visible` rule in `styles.css`.

Concrete CSS fixes (from reading the CSS; not rendered, so check each in the
built window at 1440 px light and dark):

1. **Hard-coded white breaks dark mode.** `.reproduce-languages button` sets
   `background: #fff` and `.reproduce-frame` sets `background: #fff`. The dark
   theme sets `--glass-1` to `#121328`, so the buttons and the frame's
   loading state stay white. Use `var(--glass-1, #fff)` in both.
2. **The "Open in a tab" link is a small target.** `.reproduce-head a` has no
   minimum height, while the language buttons have 32 px. Add
   `min-height: 32px; display: inline-flex; align-items: center;` so the link
   matches the buttons beside it.
3. **The project name reads at 12 px.** `.reproduce-head` sets
   `font-size: var(--t-xs, 12px)` and the `strong` inherits it, so the window's
   main label is the smallest text in its chrome. Set
   `.reproduce-head strong { font-size: var(--t-s, 13px); }`.
4. **Spacing off the 4 px grid.** `.reproduce-languages { gap: 2px; }` is the
   only 2 px gap in the app's controls (the app uses 4 px steps). Use `gap: 4px`.
5. **Link has no hover state.** `.reproduce-head a` sets only colour and
   underline offset. Add `.reproduce-head a:hover { color: var(--ink); }` so the
   link responds like the buttons.

## Part 3: order of work

1. Fix the hard-coded white (part 2, item 1) first: it is wrong in one of the
   two themes the app ships.
2. Then the size and spacing fixes (items 2 to 4), which need one visual check.
3. Item 5 is polish.

## Not verified

- No built site, so no screenshot of the notebook or of the Reproduce window.
  The theme's CSS hooks are written against JupyterLab 4 class names and must
  be checked on a built site (`apps/notebook/build.sh`, operator's approval
  first, see AGENTS.md).
- The launcher selectors (`data-category="Console"` and `"Other"`) and the
  status bar id (`#jp-main-statusbar`) are from memory of JupyterLab 4's
  markup.
- The part 2 fixes are from reading `reproduce.css`; they are not applied to the
  friend's files and need his review.
- `analysis.ipynb` (RESEARCHER-WORKFLOWS.md) is not served by `/api/lite/`; the
  window opens `reproduce.ipynb` / `reproduce-r.ipynb`.
