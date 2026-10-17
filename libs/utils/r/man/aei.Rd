\name{aei}
\alias{aei}
\alias{read_package}
\alias{connect}
\alias{verify}
\alias{verify.aei_package}
\alias{verify.aei_project}
\alias{reproduce}
\alias{fingerprint_rows}
\alias{as_amr}
\title{Read and Verify AEI Research Data}
\description{
Read the typed tables in an Antibiotic Efficacy Indicator research package,
query the read-only API, and verify a frozen project's recorded data cut.
}
\usage{
read_package(path)
connect(url, token = NULL, site = NULL)
verify(project, client = project$`_client`)
\method{verify}{aei_package}(project, client = NULL)
\method{verify}{aei_project}(project, client = project$`_client`)
reproduce(pkg)
fingerprint_rows(records_df)
as_amr(pkg_or_df)
}
\arguments{
  \item{path}{Path to a research package zip or its unpacked directory.}
  \item{url}{AEI server's base URL.}
  \item{token}{Optional bearer token.}
  \item{site}{Optional default site for data queries.}
  \item{project}{An offline \code{aei_package}, or an \code{aei_project} returned by a client's \code{project()} or \code{projects()}.}
  \item{pkg}{An offline \code{aei_package}.}
  \item{client}{An \code{aei_client}; defaults to the project's originating client.}
  \item{records_df}{A data.frame with \code{isolateId}, \code{sampleDate}, \code{ward},
    \code{organism} and a named-list \code{results} column, or a list of API records.}
  \item{pkg_or_df}{An \code{aei_package} containing an isolates table, or a data.frame.}
}
\details{
\code{read_package()} checks the \code{aei-package/1} format, rejects unsafe
resource paths, and converts columns using the descriptor's schema. An
\code{aei_package} exposes its tables both through \code{tables} and directly
(for example, \code{pkg$isolates}). Optional methods and README files default
to an empty list and empty string.

\code{connect()} provides functions \code{isolates(...)}, \code{alerts(...)},
\code{weekly(...)}, \code{clock()}, \code{sites()}, \code{projects()} and
\code{project(id)}. Query names match the API, including \code{from}, \code{to},
\code{ward}, \code{specimen}, \code{organism}, \code{sex}, \code{ageMin},
\code{ageMax} and \code{site}. Explicit \code{site = NULL} clears the default.
Isolates have one column per antibiotic, semicolon-joined \code{phenotypes}
and a \code{phenotype_list} list column. Weekly counts have one row per
ward/week with cultures and one count per phenotype. Tokens are not printed.
HTTP uses curl when available, otherwise a base R URL connection.

\code{verify(pkg)} checks exported isolates offline against the frozen
fingerprint, using fields marked \code{role: result} for antibiotic results.
Continuous packages or missing fingerprints have \code{ok = NA}.
\code{verify(project, client)} refetches rows using the project's scope and
as-of date, then checks both row count and SHA-256. It errors for live
continuous projects.
\code{reproduce(pkg)} recomputes count and distinct recipes, including equality
filters in \code{where}. Distinct excludes missing cells; null filters select
missing cells. Missing or unknown recipes remain unchecked (\code{NA}).
\code{fingerprint_rows()} implements the same D-058 canonical JSON rows as
TypeScript, sorting antibiotic codes and rows before hashing UTF-8 text.

\code{as_amr()} requires the optional AMR package. It converts antibiotic
result columns to \code{sir} and organisms to \code{mo}. Schema result roles,
titles and descriptions marking antibiotic results take priority; otherwise character
columns containing only S, I, R or missing values are selected.
The browser R kernel supports local packages, not HTTP connections.
}
\value{
\code{read_package()} returns an \code{aei_package} list containing
\code{name}, \code{title}, \code{meta}, \code{tables}, \code{fields},
\code{methods} and \code{readme}.
\code{connect()} returns an \code{aei_client} list of functions.
\code{verify()} returns a logical scalar for a live project, or an
\code{aei_verify_result} list for a package, with \code{ok}, \code{rows},
\code{sha256}, \code{expected_rows}, \code{expected_sha256} and \code{message}.
\code{reproduce()} returns a data.frame with \code{number} (label), \code{id},
\code{shown}, \code{recomputed}, \code{match} and \code{method}.
\code{fingerprint_rows()} returns a list with \code{rows} and \code{sha256}.
\code{as_amr()} returns a data.frame with converted columns.
}
\examples{
fingerprint_rows(list())
client <- connect("https://your-aei-server", site = "tyks")
print(client)
\dontrun{
pkg <- read_package("research-package.zip")
pkg$isolates
project <- client$project("spring")
verify(project, client)
as_amr(pkg)
}
}
