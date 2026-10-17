reproducible_fixture <- function() {
  root <- tempfile("aei-reproduce-")
  dir.create(root)
  records <- list(
    list(isolateId = "002", sampleDate = "2025-03-02", ward = "URO", organism = "E. coli ä / \"x\"", results = list(TZP = "S", AMC = "R")),
    list(isolateId = "001", sampleDate = "2025-03-01", ward = "ICU", organism = "NA", results = list()),
    list(isolateId = "002", sampleDate = "2025-03-01", ward = "URO", organism = "E. coli", results = list(AMC = "I"))
  )
  columns <- c("isolateId", "sampleDate", "ward", "organism", "AMC", "TZP")
  fields <- lapply(columns, function(name) {
    field <- list(name = name, type = if (name == "sampleDate") "date" else "string")
    if (name %in% c("AMC", "TZP")) field$role <- "result"
    field
  })
  descriptor <- list(name = "spring", title = "Spring", aei = list(format = "aei-package/1", mode = "frozen",
    asOf = "2025-03-02", fingerprint = fingerprint_rows(records)),
    resources = list(list(name = "isolates", path = "isolates.csv", schema = list(fields = fields))))
  table <- do.call(rbind, lapply(records, function(record) {
    row <- lapply(columns, function(name) {
      value <- if (name %in% c("AMC", "TZP")) record$results[[name]] else record[[name]]
      if (is.null(value)) NA_character_ else value
    })
    names(row) <- columns
    as.data.frame(row, stringsAsFactors = FALSE)
  }))
  utils::write.csv(table, file.path(root, "isolates.csv"), row.names = FALSE, na = "", fileEncoding = "UTF-8")
  jsonlite::write_json(descriptor, file.path(root, "datapackage.json"), auto_unbox = TRUE)
  methods <- list(
    list(label = "Isolates", id = "isolates", value = 3, method = "Row count", recipe = list(op = "count", table = "isolates")),
    list(label = "URO organisms", id = "organisms", value = 2, method = "Distinct",
         recipe = list(op = "distinct", table = "isolates", column = "organism", where = list(ward = "URO"))),
    list(label = "Wrong", value = 10, recipe = list(op = "count", table = "isolates", where = list(AMC = "R", ward = "URO"))),
    list(label = "Unknown", value = 4, recipe = list(op = "future")),
    list(label = "Missing", value = 5),
    list(label = "Untested", value = 1, recipe = list(op = "count", table = "isolates", where = list(AMC = NULL)))
  )
  jsonlite::write_json(methods, file.path(root, "methods.json"), auto_unbox = TRUE, null = "null")
  writeLines("# Reproduce", file.path(root, "README.md"))
  list(root = root, records = records)
}

test_that("offline verification and reproduction check data and numbers", {
  fixture <- reproducible_fixture()
  on.exit(unlink(fixture$root, recursive = TRUE))
  pkg <- read_package(fixture$root)
  checked <- verify(pkg)
  expect_s3_class(checked, "aei_verify_result")
  expect_true(checked$ok)
  expect_equal(checked$rows, 3L)
  expect_identical(checked$sha256, fingerprint_rows(fixture$records)$sha256)
  expect_identical(checked$expected_sha256, checked$sha256)
  expect_output(print(checked), "Same data: 3 rows, fingerprint matches the frozen project.")
  numbers <- reproduce(pkg)
  expect_named(numbers, c("number", "id", "shown", "recomputed", "match", "method"))
  expect_identical(numbers$match, c(TRUE, TRUE, FALSE, NA, NA, TRUE))
  expect_equal(numbers$recomputed[1:3], c(3, 2, 1))
  pkg$tables$isolates$AMC[1L] <- "S"
  expect_false(verify(pkg)$ok)
  expect_output(print(verify(pkg)), "Data changed")
  pkg$meta$mode <- "continuous"
  expect_true(is.na(verify(pkg)$ok))
  expect_output(print(verify(pkg)), "Continuous project: no frozen fingerprint to check; 3 rows as of 2025-03-02.")
  pkg$methods <- list()
  expect_named(reproduce(pkg), names(numbers))
  expect_equal(nrow(reproduce(pkg)), 0L)
})

test_that("writer top-folder zip loads and verifies offline", {
  skip_if(Sys.which("zip") == "", "zip executable unavailable")
  fixture <- reproducible_fixture()
  archive <- tempfile(fileext = ".zip")
  on.exit(unlink(c(fixture$root, archive), recursive = TRUE))
  old <- setwd(dirname(fixture$root))
  tryCatch(utils::zip(archive, basename(fixture$root), flags = "-qr", zip = Sys.which("zip")), finally = setwd(old))
  expect_equal(read_package(archive), read_package(fixture$root))
  expect_true(verify(read_package(archive))$ok)
  expect_true(all(reproduce(read_package(archive))$match[c(1L, 2L, 6L)]))
})

test_that("offline fixture has TypeScript fingerprint parity", {
  node <- Sys.which("node")
  skip_if(node == "", "Node is unavailable")
  root <- normalizePath(getwd())
  repeat {
    module <- file.path(root, "libs/utils/projects/src/node.ts")
    if (file.exists(module) || dirname(root) == root) break
    root <- dirname(root)
  }
  skip_if_not(file.exists(module), "TypeScript source is not included in the installed R package")
  fixture <- reproducible_fixture()
  input <- tempfile(fileext = ".json")
  script <- tempfile(fileext = ".mjs")
  output <- tempfile()
  errors <- tempfile()
  on.exit(unlink(c(fixture$root, input, script, output, errors), recursive = TRUE))
  jsonlite::write_json(fixture$records, input, auto_unbox = TRUE)
  writeLines(c(
    paste0("import { fingerprintRows } from ", as.character(jsonlite::toJSON(paste0("file://", module), auto_unbox = TRUE)), ";"),
    "import { readFileSync } from 'node:fs';",
    "console.log(JSON.stringify(fingerprintRows(JSON.parse(readFileSync(process.argv[2], 'utf8')))));"
  ), script)
  status <- system2(node, c("--experimental-strip-types", shQuote(script), shQuote(input)), stdout = output, stderr = errors)
  expect_equal(status, 0L, info = paste(readLines(errors), collapse = "\n"))
  expected <- jsonlite::fromJSON(output)
  checked <- verify(read_package(fixture$root))
  expect_equal(list(rows = checked$rows, sha256 = checked$sha256), expected)
})
