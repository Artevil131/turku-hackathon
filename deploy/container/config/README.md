Put a site's code map here (e.g. `codes.json`, see `libs/utils/ingest` CodeMaps) and set
`AEI_CODE_MAP=/config/codes.json`. The directory is mounted read-only into the API container.

Other hospitals (D-051): copy `sites.example.json` to `sites.json`, replace the token with a long
random one (the Connect page makes one), `chmod 600 sites.json`, and set `AEI_SITES=/config/sites.json`.
See deploy/integration.md, "Connecting a second hospital". Do not commit a `sites.json` with real tokens.
