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

| `ux-loop-7` | "Add a window" menu names what each window shows, with one line under it ("Which antibiotic to start", "Alerts and clusters", "Finnish county map"…) instead of internal names ("Treat a patient", "Signal", "Summary") | the names told a new user nothing |

Only the add-a-window picker and the Windows tray use the new names; the window titles themselves are unchanged.

| `ux-loop-8` | Doctor's Treat-a-patient window: only the working antibiotic's name is green (headline and the "also good enough" rows), the rest in ink, with a share bar and the bar's tick per row; the case (syndrome, unit, specimen, severity, "More about the patient") sits in a panel beside the answer instead of an empty right side, "Edit case" is a clear button on narrow screens; the data level is three readable rows ("not needed" instead of a dash); doctor text 14 to 17 px | judge: cluttered, small, hard to read; user: emphasise non-resistant drugs, structure the filters, use the empty right side |

Checked in the browser on a narrow pane only (the narrow layout and the data-level rows); the wide two-column layout was seen once before the last tweaks and not re-checked.

| `ux-loop-9` | Add-a-window names lead with the window's own title, then what it shows ("Timeline: weeks by ward", "Treat a patient: which antibiotic"). A click on the timeline's weekly chart moves the replay clock to the end of that week (a drag still chooses weeks; pills, lanes and the chosen weeks keep their clicks) | user could not find the timeline: the menu called it "Weeks of resistance by ward" while the window says "Timeline"; clicking the timeline did nothing to the date |

Not checked with a real user.

| `ux-loop-10` | Patient flow: the paragraph that repeated the numbers is gone, the column heads read "Sampled before / after MED-A", the info text is one short block. Map: with a signal selected, the map switches to the THL series of the same phenotype (as before) and now draws a red ring on Tyks with a dashed line to a chip naming the unit and the series; clicking the chip opens Varsinais-Suomi's detail. The caption and how-to lines and the signal banner are gone (their facts sit behind the ⓘ); referral lines and hospital labels are fainter; county detail keeps its marker and VRE lines, the forecast caveats sit behind an ⓘ | the map showed a different dataset with no visible tie to the signal; both windows carried prose that restated the picture |

Checked in the browser (map with the ESBL signal selected at normal and focus size; patient flow at normal size). Not checked: the other windows were audited by their copy only and left as they were; patient flow in focus mode renders far too tall in my test browser, which I did not trace.

| `ux-loop-11` | Tools: the method line under every result is gone (the Method block has it), the notebook no longer shows the method twice or a second Copy as Python, tool names and hints lose their decision ids and statistics terms ("Find clusters", "Share estimate", "Unusual counts in this slice"). Add-a-window: only the title is bold, the entries are ordered answer, evidence, time and place, workbench, and two labels that promised what the window does not do are fixed (the explanation window has no question box; the unit grid is weeks down, units across). Infection-control demo: the evidence window opens at the head of the right column instead of as a narrow tall strip that pushed the signal list down, so the board has two aligned columns and no hole (demo version 12) | the demo showed a gap beside the notebook; a pasted review found the two untrue labels |

Checked in the browser: the control demo replayed with the new columns. Not checked on screen: the new picker order and weights (typecheck and tests only), the tool result cards after the cut.

