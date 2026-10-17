fingerprint_fixture <- function() list(
  list(isolateId = "i2", sampleDate = "2025-03-03", ward = "URO", organism = "Escherichia coli ä",
       results = list(TZP = "S", AMC = "R")),
  list(isolateId = "i1", sampleDate = "2025-03-01", ward = "ICU", organism = "Empty / \"quote\"\n\t\\",
       results = list()),
  list(isolateId = "i2", sampleDate = "2025-03-02", ward = "ICU", organism = "Bactéria",
       results = list(AMC = "R", TZP = "R"))
)

test_that("empty fingerprint and row ordering match D-058", {
  expect_equal(fingerprint_rows(list()), list(rows = 0L,
    sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"))
  records <- fingerprint_fixture()
  expect_identical(fingerprint_rows(records), fingerprint_rows(rev(records)))
  changed <- records
  changed[[1]]$results <- list(AMC = "R", TZP = "S")
  expect_identical(fingerprint_rows(records), fingerprint_rows(changed))
  frame <- data.frame(isolateId = vapply(records, `[[`, "", "isolateId"),
                      sampleDate = vapply(records, `[[`, "", "sampleDate"),
                      ward = vapply(records, `[[`, "", "ward"),
                      organism = vapply(records, `[[`, "", "organism"))
  frame$results <- I(lapply(records, `[[`, "results"))
  expect_identical(fingerprint_rows(frame), fingerprint_rows(records))
  changed[[1]]$results$AMC <- "S"
  expect_false(identical(fingerprint_rows(records), fingerprint_rows(changed)))
})

test_that("fingerprints match TypeScript with Unicode, escapes and empty results", {
  node <- Sys.which("node")
  skip_if(node == "", "Node is unavailable")
  root <- normalizePath(getwd())
  repeat {
    module <- file.path(root, "libs/utils/projects/src/node.ts")
    if (file.exists(module) || dirname(root) == root) break
    root <- dirname(root)
  }
  skip_if_not(file.exists(module), "TypeScript source is not included in the installed R package")
  input <- tempfile(fileext = ".json")
  script <- tempfile(fileext = ".mjs")
  output <- tempfile()
  errors <- tempfile()
  on.exit(unlink(c(input, script, output, errors)))
  jsonlite::write_json(fingerprint_fixture(), input, auto_unbox = TRUE)
  writeLines(c(
    paste0("import { fingerprintRows } from ", as.character(jsonlite::toJSON(paste0("file://", module), auto_unbox = TRUE)), ";"),
    "import { readFileSync } from 'node:fs';",
    "console.log(JSON.stringify(fingerprintRows(JSON.parse(readFileSync(process.argv[2], 'utf8')))));"
  ), script)
  status <- system2(node, c("--experimental-strip-types", shQuote(script), shQuote(input)), stdout = output, stderr = errors)
  expect_equal(status, 0L, info = paste(readLines(errors), collapse = "\n"))
  expected <- jsonlite::fromJSON(output)
  expect_equal(fingerprint_rows(fingerprint_fixture()), expected)
  expect_equal(fingerprint_rows(rev(fingerprint_fixture())), expected)
})
