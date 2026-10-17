// Where the JupyterLite site (apps/notebook, D-062) is served and how a project opens in it. The site is
// built into apps/web/public/notebook by apps/notebook/build.sh; on a branch without a build the window
// shows its empty state until the site exists. Change the site path here and nowhere else.

/** The served site; the dev server and the production build both serve public/notebook here. */
export const NOTEBOOK_SITE = "/notebook/";

/** The notebook a project opens on: the Python starter the API serves in each project folder. */
export const NOTEBOOK_FILE = "reproduce.ipynb";

/** The JupyterLab page with the project's notebook open (`?path=` is relative to the site's files root). */
export function notebookHref(projectId: string): string {
  return `${NOTEBOOK_SITE}lab/index.html?path=${encodeURIComponent(`projects/${projectId}/${NOTEBOOK_FILE}`)}`;
}

/**
 * The line a researcher pastes into their own Python session to load the same cut (D-061). `origin` is the
 * web app's origin, so the API is reached through the same /api the page uses.
 */
export function connectSnippet(origin: string, projectId: string | null): string {
  return `aei.connect("${origin}/api").project("${projectId ?? "PROJECT_ID"}")`;
}
