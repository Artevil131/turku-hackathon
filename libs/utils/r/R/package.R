.safe_path <- function(path) {
  if (length(path) != 1L || is.na(path) || !nzchar(path) ||
      grepl("^[/\\\\]|^[A-Za-z]:", path) ||
      ".." %in% strsplit(path, "[/\\\\]")[[1L]]) {
    stop("Resource path escapes the package: ", path, call. = FALSE)
  }
  path
}

.package_file <- function(root, path) {
  target <- normalizePath(file.path(root, .safe_path(path)), mustWork = TRUE)
  if (!startsWith(target, paste0(root, .Platform$file.sep))) {
    stop("Resource path escapes the package: ", path, call. = FALSE)
  }
  target
}

.read_table <- function(path, fields) {
  table <- utils::read.csv(path, colClasses = "character", na.strings = "",
                           fileEncoding = "UTF-8", check.names = FALSE)
  names(table)[1L] <- sub(paste0("^", intToUtf8(65279)), "", names(table)[1L])
  for (field in fields) {
    name <- field$name
    if (!name %in% names(table)) stop("Missing field: ", name, call. = FALSE)
    column <- table[[name]]
    table[[name]] <- switch(field$type,
      integer = {
        if (any(!is.na(column) & !grepl("^[+-]?[0-9]+$", column))) {
          stop("Invalid integer in column ", name, call. = FALSE)
        }
        suppressWarnings(as.integer(column))
      },
      number = suppressWarnings(as.numeric(column)),
      date = {
        if (any(!is.na(column) & !grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", column))) {
          stop("Invalid date in column ", name, call. = FALSE)
        }
        as.Date(column, format = "%Y-%m-%d")
      },
      datetime = {
        normalized <- sub("Z$", "+0000", sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", column))
        zoned <- grepl("[+-][0-9]{4}$", normalized)
        normalized[!is.na(normalized) & !zoned] <- paste0(normalized[!is.na(normalized) & !zoned], "+0000")
        as.POSIXct(normalized, format = "%Y-%m-%dT%H:%M:%OS%z", tz = "UTC")
      },
      boolean = {
        values <- tolower(column)
        if (any(!is.na(values) & !values %in% c("true", "false", "1", "0"))) {
          stop("Invalid boolean in column ", name, call. = FALSE)
        }
        as.logical(ifelse(is.na(values), NA, values %in% c("true", "1")))
      },
      string = as.character(column),
      stop("Unsupported field type: ", field$type, call. = FALSE)
    )
    if (any(!is.na(column) & is.na(table[[name]]))) {
      stop("Invalid ", field$type, " in column ", name, call. = FALSE)
    }
  }
  table
}

read_package <- function(path) {
  if (dir.exists(path)) {
    root <- normalizePath(path, mustWork = TRUE)
  } else {
    entries <- utils::unzip(path, list = TRUE)$Name
    invisible(lapply(entries, .safe_path))
    root <- tempfile("aei-package-")
    dir.create(root)
    on.exit(unlink(root, recursive = TRUE), add = TRUE)
    utils::unzip(path, exdir = root)
    root <- normalizePath(root, mustWork = TRUE)
  }
  descriptor <- jsonlite::fromJSON(.package_file(root, "datapackage.json"), simplifyVector = FALSE)
  if (!identical(descriptor$aei$format, "aei-package/1")) {
    stop("Expected AEI package format 'aei-package/1'", call. = FALSE)
  }
  tables <- fields <- list()
  for (resource in descriptor$resources) {
    file <- .package_file(root, resource$path)
    fields[[resource$name]] <- resource$schema$fields
    tables[[resource$name]] <- .read_table(file, resource$schema$fields)
  }
  methods <- if (file.exists(file.path(root, "methods.json"))) {
    jsonlite::fromJSON(.package_file(root, "methods.json"), simplifyVector = FALSE)
  } else list()
  readme <- if (file.exists(file.path(root, "README.md"))) {
    file <- .package_file(root, "README.md")
    sub(paste0("^", intToUtf8(65279)), "", readChar(file, file.info(file)$size, useBytes = TRUE))
  } else ""
  structure(list(name = descriptor$name, title = descriptor$title, meta = descriptor$aei,
                 tables = tables, fields = fields, methods = methods, readme = readme),
            class = "aei_package")
}

`$.aei_package` <- function(x, name) {
  elements <- unclass(x)
  if (name %in% names(elements)) elements[[name]] else elements$tables[[name]]
}

print.aei_package <- function(x, ...) {
  cat("AEI package: ", x$name, "\n", sep = "")
  for (name in names(x$tables)) {
    table <- x$tables[[name]]
    cat("  ", name, ": ", nrow(table), " rows x ", ncol(table), " columns\n", sep = "")
  }
  invisible(x)
}
