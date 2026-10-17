.amr_columns <- function(table, fields) {
  marked <- vapply(fields, function(field) {
    grepl("antibiotic|susceptibility|S/I/R", paste(c(field$title, field$description), collapse = " "), ignore.case = TRUE)
  }, logical(1))
  columns <- if (any(marked)) {
    vapply(fields[marked], function(field) field$name, character(1))
  } else {
    names(table)[vapply(table, function(column) {
      is.character(column) && all(is.na(column) | column %in% c("S", "I", "R"))
    }, logical(1))]
  }
  setdiff(columns, "organism")
}

as_amr <- function(pkg_or_df) {
  if (!requireNamespace("AMR", quietly = TRUE)) {
    stop("Install AMR first with install.packages('AMR')", call. = FALSE)
  }
  if (inherits(pkg_or_df, "aei_package")) {
    table <- pkg_or_df$isolates
    fields <- pkg_or_df$fields$isolates
    if (is.null(table)) stop("Package has no isolates table", call. = FALSE)
  } else {
    table <- pkg_or_df
    fields <- list()
  }
  if (!is.data.frame(table)) stop("Expected an AEI package or data.frame", call. = FALSE)
  for (name in intersect(.amr_columns(table, fields), names(table))) table[[name]] <- AMR::as.sir(table[[name]])
  if ("organism" %in% names(table)) table$organism <- AMR::as.mo(table$organism)
  table
}
