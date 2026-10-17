#' Read the live method registry
#'
#' Returns the bundled TypeScript registry snapshot: definitions, parameter
#' defaults and decision/experiment ids. R does not implement the detectors.
#' @return A list of method definitions.
#' @export
methods_registry <- function() {
  path <- system.file("registry.json", package = "aei", mustWork = TRUE)
  jsonlite::fromJSON(path, simplifyVector = FALSE)
}
