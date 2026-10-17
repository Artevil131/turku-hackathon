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

The reader retains the descriptor's types, missing values, methods and README.
Isolate API results become one column per antibiotic; `phenotypes` is joined
with `;`, and `phenotype_list` retains the individual codes. Query arguments
use the API's names (`from`, `to`, `ward`, `specimen`, `organism`, `sex`,
`ageMin`, `ageMax`, `site`). Pass `site = NULL` to clear a client's site default.
`verify()` refetches released rows using the project's scope and as-of date,
not the client's site default; continuous projects cannot be verified.
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
