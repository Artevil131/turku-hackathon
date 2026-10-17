# Usability loops, branch `ux/usability-loop`

Claude Code (Sonnet 5.5), 2026-10-17. Prompted by the judge's remarks: UI and
graphs are cluttered, hard to read and small in places; users need quicker
access to the result of a specific query. Each loop is one commit with a git
tag, so any version can be checked out: `git checkout ux-loop-N`.

| Tag | Change | Why |
|---|---|---|
| `ux-loop-1` | Timeline text at least 12 px (was 9.5 to 11); pill width estimate follows | "small at places" |
| `ux-loop-2` | Board toolbar: visible "Find a ward, signal or drug  /" button opens the search | search was hidden behind `/` and Ctrl+K |
| `ux-loop-3` | Window "i" buttons fade until hover or focus (always visible on touch) | fewer icons on a still screen |
| `ux-loop-4` | Search opens with "Your last picks" (3, kept in localStorage) above recent alerts and pages | a repeated query is one click |

A Sonnet judge read the diffs after loop 3 and scored usability 6/10, pointing
to loop 4 as the next best change. Not run by the judge: the app. Not done:
the dense research board itself (window count, repeated signal in 5 places;
see overwhelm-analysis.md cuts 1, 2, 3, 4), no test with a real user.

Added at the user's request (no judge run):

| `ux-loop-5` | Windows grow to fit their content instead of scrolling inside (not saved; Notebook, Timeline, Signals and Assistant keep their own scroll) | "I don't like scrolling inside the windows" |

| `ux-loop-6` | Start page asks "I work as…" (7 professions: ward doctor, infection control, stewardship, microbiology lab, researcher, regional surveillance, management). The choice (kept in the browser) reorders templates, picks the example questions and the suggested demo. Recent projects, demos and templates stay for everyone | the page serves one reader at a time without hiding anything; doctors keep their projects |

Not checked: the chips for stewardship, lab, surveillance and management open existing views (antibiogram, unit grid, map, data page) rather than purpose-made answers; no real user from those professions has said these are their questions.
