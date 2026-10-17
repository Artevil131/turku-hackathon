---
version: 1
slug: "notebook-critique"
primary_target: "apps/notebook/build.sh"
related_targets:
  - "apps/notebook/files/projects/README.md"
  - "apps/web/src/components/research/workspace/layout.ts"
  - "apps/web/vite.config.ts"
---

# Notebook (JupyterLite), 17 Oct 2026: critique before the theme

Method: no browser pass. There is no built JupyterLite on this branch
(`apps/web/public/notebook` does not exist; `apps/notebook/build/` is empty),
and a build needs micromamba to pack the xeus-r environment from conda, plus the
Pyodide CDN. The size of that download is not known from here, so per AGENTS.md
the build was not run. This critique reads the sources (`build.sh`,
`pyproject.toml`, `files/`), the API's `/api/lite/` routes, and the dev proxy
(`/notebook/api/...` and `/notebook/files/...` in `vite.config.ts`).

## What clashes with the app

1. **Fonts.** The app's stack is Inter for UI and data and Bricolage Grotesque
   for display (`--font-ui`, `--font-data`, `--font-display` in
   `apps/web/src/styles.css`). JupyterLab ships its own system stack
   (`--jp-ui-font-family`, `--jp-content-font-family`, monospace for code), so
   the notebook reads as a different product beside the research page.
2. **Colour.** JupyterLab's default is a grey chrome with blue brand and a
   dark-grey sidebar. Ours is a pale ground with flat white panels, one violet
   accent (`--brand-accent` #635bf1), navy ink (`--ink` #07081c). Nothing in the
   notebook uses those tokens, so the accent in the Reproduce window and the
   blue in the notebook fight each other.
3. **Chrome.** The menu bar, the tab bar, the left file browser and the
   status bar all carry JupyterLab's default padding and 1 px grey dividers.
   Our panels use `--radius-panel` (10 px) and `--line`; the notebook uses
   square corners. The status bar is an extra strip the app does not have.
4. **Launcher clutter.** The launcher offers Notebook, Console, Text File,
   Markdown, Python File, Contextual Help, Show Contextual Help, and the Other
   section (Terminal, Settings). A researcher reproducing a number needs Python
   and R notebooks and the file list, nothing else. Console and Terminal are
   not available in the Pyodide kernel anyway.
5. **Where the project data appears.** The API serves each project as a folder
   under `projects/<id>/` (`reproduce.ipynb`, `reproduce-r.ipynb`, the data,
   `datapackage.json`, the method notes). The file browser shows the project
   id as the folder name and the notebook as one file among several, so the
   user cannot tell which project or data cut the notebook runs on until they
   read the first cell. The Reproduce window (a planned item) should state the
   project and cut in one line above the notebook.
6. **Entry point is hidden.** Nothing in the research page links to the
   notebook yet, and the proxy routes exist only in the dev server. A user who
   finds the notebook will land on the JupyterLab launcher, not on the project.

## Top findings, in order

1. The notebook looks like a different application: fonts and colours (1, 2).
   Fixing the tokens in one stylesheet changes most of it.
2. The launcher lists tools the reproduction does not use (4). Hiding them
   removes the first thing a researcher sees.
3. The notebook opens on the launcher, not on the project (6). The window
   should open the project's notebook directly.
4. The project and data cut are not visible in the notebook (5). One header
   line in the window fixes it without touching the notebook.

## Not verified

- No built site, so no screenshot. The CSS hooks in the theme are written
  against JupyterLab 4 class names and must be checked on a built site.
- The served notebook is `reproduce.ipynb` (the package and the API), not
  `analysis.ipynb` as the brief said; `analysis.ipynb` is the research-package
  name in RESEARCHER-WORKFLOWS.md and is not served by `/api/lite/`.
