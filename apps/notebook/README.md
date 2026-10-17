# Notebook (JupyterLite)

The static JupyterLite site behind the Reproduce window in the research
workspace (D-062, D-063). Built by `build.sh` into `apps/web/public/notebook`,
served beside the web app at `/notebook/`. Project folders come from the API's
`/api/lite/` routes, so the build keeps no project data.

## The theme

`theme/aei-theme.css` restyles JupyterLab with the research page's tokens
(fonts, the white panels on the pale ground, the violet accent, navy ink,
10 px corners) and hides the launcher sections the reproduction does not use
(Console, Other), plus the status bar.

It is applied at build time, not in the page source:

1. `build.sh` copies it to the site root as `aei-theme.css`.
2. It adds `<link rel="stylesheet">` just before `</head>` in
   `index.html` and `lab/index.html`, so it loads after JupyterLab's own
   theme and wins on equal specificity.

The colours are written as hex, copied from `apps/web/src/styles.css`, because
the notebook is a separate static app and cannot read the web app's custom
properties. When a token changes there, change it here too.

Light theme only. The launcher selectors follow JupyterLab 4's markup and are
not yet checked against a built site.

## Building

```bash
apps/notebook/build.sh            # writes apps/web/public/notebook
```

Needs `uv` and `micromamba` (the R environment is packed from conda, see
`build.sh`). The build downloads the xeus-r environment and loads Pyodide from
its CDN, so it is not run in routine work; ask the operator first (AGENTS.md).

## Opening a project

The Reproduce window on main (`projects/Reproduce.tsx`) opens
`lab/index.html?path=projects/<id>/reproduce.ipynb`, or `reproduce-r.ipynb` for R.
`analysis.ipynb` is the research package's name in RESEARCHER-WORKFLOWS.md; the
API does not serve it, so the window opens the reproduce notebooks instead.

## The page's own Python kernel

The Notebook window runs Python in the page (D-077, proposed) and installs `aei` from
`apps/web/public/notebook/pypi`. Without the full build, `apps/notebook/wheel.sh` (or
`pnpm notebook:wheel`) writes just the wheel and its pointer there; it needs only uv.
