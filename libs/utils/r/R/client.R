.http_get <- function(url, headers) {
  if (requireNamespace("curl", quietly = TRUE)) {
    handle <- curl::new_handle()
    curl::handle_setheaders(handle, .list = headers)
    response <- curl::curl_fetch_memory(url, handle = handle)
    return(list(status = response$status_code, body = rawToChar(response$content)))
  }
  warnings <- character()
  tryCatch(withCallingHandlers({
    connection <- base::url(url, open = "rb", headers = headers)
    on.exit(close(connection))
    list(status = 200L, body = paste(readLines(connection, warn = FALSE, encoding = "UTF-8"), collapse = "\n"))
  }, warning = function(w) {
    warnings <<- c(warnings, conditionMessage(w))
    invokeRestart("muffleWarning")
  }), error = function(e) {
    # Base URL connections discard error bodies; retain their HTTP status warning.
    stop(paste(c(warnings, conditionMessage(e)), collapse = "; "), call. = FALSE)
  })
}

.api_get <- function(url, token, path, query = list()) {
  query <- query[!vapply(query, is.null, logical(1))]
  encode <- function(x) utils::URLencode(as.character(x), reserved = TRUE)
  params <- vapply(names(query), function(key) paste0(encode(key), "=", encode(query[[key]])), character(1))
  target <- paste0(sub("/+$", "", url), path,
                   if (length(params)) paste0("?", paste(params, collapse = "&")) else "")
  headers <- c(Accept = "application/json")
  if (!is.null(token) && nzchar(token)) headers <- c(headers, Authorization = paste("Bearer", token))
  response <- .http_get(target, headers)
  data <- tryCatch(jsonlite::fromJSON(response$body, simplifyVector = FALSE), error = function(e) NULL)
  if (response$status >= 400L) {
    message <- if (is.list(data) && !is.null(data$error)) data$error else response$body
    stop("HTTP ", response$status, ": ", message, call. = FALSE)
  }
  if (is.null(data)) stop("Invalid JSON response", call. = FALSE)
  data
}

.records <- function(records) {
  if (is.data.frame(records)) {
    return(lapply(seq_len(nrow(records)), function(i) lapply(records, function(column) {
      if (is.list(column)) column[[i]] else column[i]
    })))
  }
  records
}

.rows_frame <- function(rows) {
  if (!length(rows)) return(data.frame())
  keys <- unique(unlist(lapply(rows, names), use.names = FALSE))
  columns <- lapply(keys, function(key) {
    values <- lapply(rows, function(row) if (is.null(row[[key]])) NA else row[[key]])
    if (all(vapply(values, function(value) is.atomic(value) && length(value) == 1L, logical(1)))) {
      unlist(values, use.names = FALSE)
    } else I(values)
  })
  names(columns) <- keys
  as.data.frame(columns, optional = TRUE, stringsAsFactors = FALSE)
}

.isolates_frame <- function(records) {
  rows <- lapply(records, function(record) {
    row <- record[setdiff(names(record), c("results", "phenotypes"))]
    row[names(record$results)] <- record$results
    row$phenotypes <- paste(unlist(record$phenotypes), collapse = ";")
    row
  })
  table <- .rows_frame(rows)
  if (length(records)) table$phenotype_list <- I(lapply(records, function(record) unlist(record$phenotypes, use.names = FALSE)))
  table
}

.project <- function(project, client, drift = NULL) {
  project["asOf"] <- list(project$asOf)
  project["fingerprint"] <- list(project$fingerprint)
  project["drift"] <- list(drift)
  project$`_client` <- client
  structure(project, class = "aei_project")
}

connect <- function(url, token = NULL, site = NULL) {
  get <- function(path, query = list()) .api_get(url, token, path, query)
  query <- function(args) {
    if (!"site" %in% names(args)) args["site"] <- list(site)
    args
  }
  client <- structure(list(
    url = url, site = site,
    isolates = function(...) .isolates_frame(get("/api/isolates", query(list(...)))$records),
    alerts = function(...) .rows_frame(get("/api/alerts", query(list(...)))$alerts),
    weekly = function(...) {
      data <- get("/api/weekly", query(list(...)))
      rows <- list()
      for (ward in names(data$units)) {
        counts <- data$units[[ward]]
        for (i in seq_along(data$weeks)) {
          rows[[length(rows) + 1L]] <- c(list(ward = ward, week = data$weeks[[i]], cultures = counts$cultures[[i]]),
                                        lapply(counts$phenotypes, function(values) values[[i]]))
        }
      }
      .rows_frame(rows)
    },
    clock = function() get("/api/clock"),
    sites = function() get("/api/sites")$sites,
    projects = function() lapply(get("/api/projects")$projects, function(p) .project(p, client)),
    project = function(id) {
      data <- get(paste0("/api/projects/", utils::URLencode(id, reserved = TRUE)))
      .project(data$project, client, data$drift)
    },
    .get = get
  ), class = "aei_client")
  client
}

fingerprint_rows <- function(records_df) {
  records <- .records(records_df)
  ids <- vapply(records, function(record) record$isolateId, character(1))
  rows <- vapply(records, function(record) {
    codes <- sort(as.character(names(record$results)), method = "radix")
    results <- lapply(codes, function(code) list(code, record$results[[code]]))
    as.character(jsonlite::toJSON(list(record$isolateId, record$sampleDate, record$ward,
                                       record$organism, results), auto_unbox = TRUE, null = "null"))
  }, character(1))
  rows <- rows[order(ids, rows, method = "radix")]
  list(rows = length(rows), sha256 = digest::digest(enc2utf8(paste(rows, collapse = "\n")), algo = "sha256", serialize = FALSE))
}

verify <- function(project, client = project$`_client`) UseMethod("verify")

verify.aei_project <- function(project, client = project$`_client`) {
  if (!identical(project$mode, "frozen")) stop("Only frozen projects have a fingerprint to verify", call. = FALSE)
  if (is.null(client) || is.null(project$asOf) || is.null(project$fingerprint)) {
    stop("Verification needs a client, asOf and fingerprint", call. = FALSE)
  }
  scope <- project$scope
  units <- unlist(scope$units)
  to <- min(project$asOf, if (is.null(scope$to)) project$asOf else scope$to)
  records <- client$.get("/api/isolates", list(from = scope$from, to = to, site = scope$site,
                                             ward = if (length(units) == 1L) units[[1L]] else NULL))$records
  records <- Filter(function(r) {
    (is.null(scope$from) || r$sampleDate >= scope$from) && r$sampleDate <= to &&
      (!length(units) || r$ward %in% units) &&
      (!length(scope$organisms) || r$organism %in% unlist(scope$organisms)) &&
      (!length(scope$phenotypes) || any(unlist(r$phenotypes) %in% unlist(scope$phenotypes)))
  }, records)
  fingerprint <- fingerprint_rows(records)
  identical(fingerprint$sha256, project$fingerprint$sha256) && fingerprint$rows == project$fingerprint$rows
}

print.aei_client <- function(x, ...) {
  cat("AEI client: ", x$url, if (!is.null(x$site)) paste0(" (site ", x$site, ")"), "\n", sep = "")
  invisible(x)
}

print.aei_project <- function(x, ...) {
  cat("AEI project: ", x$name, " [", x$id, ", ", x$mode, "]\n", sep = "")
  invisible(x)
}
