# aei for R

Read the AEI research package and reproduce a frozen project's data cut
(D-058, D-060, D-061, D-063). The detectors and coverage methods are not
ported to R; use R's own analysis tools on the same rows.

```r
remotes::install_github('Artevil131/turku-hackathon', subdir = 'libs/utils/r')
library(aei)

pkg <- read_package('research-package.zip')  # or its unpacked folder
pkg$isolates
pkg$fields$isolates                         # column dictionary
pkg$methods
verify(pkg)                                # same frozen rows, checked offline
reproduce(pkg)                             # number, id, shown, recomputed, match, method

client <- connect('https://your-aei-server', token = Sys.getenv('AEI_TOKEN'), site = 'tyks')
rows <- client$isolates(from = '2025-03-01', to = '2025-03-31', ward = 'URO')
client$alerts()
client$weekly()
client$clock()
client$sites()
client$projects()
project <- client$project('your-project-id')
verify(project, client)                     # TRUE if row count and SHA-256 match

# Optional; install.packages('AMR') first:
isolates <- as_amr(pkg)                     # antibiotic sir and organism mo columns
```

## Reproduce the same data and numbers

`verify(pkg)` recomputes the D-058 row count and SHA-256 from the exported
isolates, using schema fields marked `role: "result"` for antibiotic results.
It works offline and prints “Same data” or “Data changed”. Its classed list
contains `ok`, `rows`, `sha256`, `expected_rows`, `expected_sha256` and
`message`. Continuous packages and packages without a frozen fingerprint
return `ok = NA`, rather than claiming that the data matches.

`reproduce(pkg)` checks count and distinct recipes in `methods.json`, with
optional equality filters in `where`. Distinct counts exclude missing cells;
a null filter selects missing cells. A wrong shown value gives `match = FALSE`;
missing or unknown recipes give `NA` for both `match` and `recomputed`. This
checks supported numbers without porting the detectors to R or claiming that
unsupported numbers were reproduced. Root-layout zips and the writer's
single-top-folder zips both work.

The reader retains the descriptor's types, missing values, methods and README.
Isolate API results become one column per antibiotic; `phenotypes` is joined
with `;`, and `phenotype_list` retains the individual codes. Query arguments
use the API's names (`from`, `to`, `ward`, `specimen`, `organism`, `sex`,
`ageMin`, `ageMax`, `site`). Pass `site = NULL` to clear a client's site default.
`verify(project, client)` refetches released rows using the project's scope and
as-of date, not the client's site default; live continuous projects cannot
be verified.
`fingerprint_rows()` accepts a data.frame with a named-list `results` column
(or a list of API records).

HTTP uses the optional `curl` package when installed, otherwise base R's
`url()` connection. Install `curl` to retain the server's JSON error messages:
base R discards HTTP error bodies, so its fallback reports the connection's
status warning instead. In the browser R kernel (xeus-r), only `read_package()`
works: there is no HTTP client support. Load a downloaded research package
there rather than connecting to a server.

The repository has no root LICENSE. The package's required License metadata
is provisionally `Unlimited`; this is not a new repository-wide license grant
and needs the team's licensing decision before distribution.

## Licence

Not chosen yet (the team decides; work in progress). `DESCRIPTION` says `Unlimited` and `pyproject.toml` names none only as placeholders, not as a choice.
