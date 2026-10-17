# @aei/projects

Server-stored research scopes (D-057), continuous or frozen at an as-of
date (D-058). The browser-safe main entry exports `Project`, `ProjectInput`,
`ProjectScope`, `parseProjectInput`, `isProjectId` and `matchesScope`.
Empty filter arrays match everything; phenotype filters match any overlap.
Site filtering belongs to the caller; alert kinds and the board hash are
saved view settings, not isolate filters.

`@aei/projects/node` exports:

    newProjectId(name)          // safe slug + random suffix
    fingerprintRows(records)   // row count + SHA-256, stable across row/result-key order
    createProjectStore(dir?)   // list, get, put, delete; memory when dir is absent

The file store creates `<dir>/projects` lazily, writes `<id>.json` by atomic
rename and ignores malformed project files. `list` is newest-updated first.
The fingerprint hashes isolate id, sample date, ward, organism and sorted
results, in isolate-id order. Frozen projects pin a live-data cut, not a
copy: the API recomputes this fingerprint on reads to report drift without
moving the shared replay clock.
