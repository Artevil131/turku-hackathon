package_fixture <- function() {
  root <- tempfile("aei-fixture-")
  dir.create(root)
  fields <- list(
    list(name = "isolateId", type = "string"), list(name = "count", type = "integer"),
    list(name = "fraction", type = "number"), list(name = "sampleDate", type = "date"),
    list(name = "releasedAt", type = "datetime"), list(name = "flag", type = "boolean"),
    list(name = "AMC", type = "string", description = "Antibiotic result S/I/R"),
    list(name = "organism", type = "string")
  )
  descriptor <- list(name = "spring", title = "Spring project", aei = list(format = "aei-package/1"),
                     resources = list(list(name = "isolates", path = "isolates.csv", schema = list(fields = fields))))
  jsonlite::write_json(descriptor, file.path(root, "datapackage.json"), auto_unbox = TRUE)
  writeLines(c("﻿isolateId,count,fraction,sampleDate,releasedAt,flag,AMC,organism",
               "001,2,0.25,2025-03-01,2025-03-01T12:00:00Z,true,R,Escherichia coli ä",
               "002,,,2025-03-02,2025-03-02T14:00:00+02:00,false,,NA"),
             file.path(root, "isolates.csv"), useBytes = TRUE)
  list(root = root, descriptor = descriptor)
}

test_that("folder tables retain schema, text and types", {
  fixture <- package_fixture()
  on.exit(unlink(fixture$root, recursive = TRUE))
  writeLines("Research methods", file.path(fixture$root, "README.md"))
  jsonlite::write_json(list(list(method = "wilson")), file.path(fixture$root, "methods.json"), auto_unbox = TRUE)
  pkg <- read_package(fixture$root)
  expect_s3_class(pkg, "aei_package")
  expect_identical(pkg$isolates, pkg$tables$isolates)
  expect_identical(pkg$isolates$isolateId, c("001", "002"))
  expect_identical(pkg$isolates$count, c(2L, NA_integer_))
  expect_equal(pkg$isolates$fraction, c(0.25, NA_real_))
  expect_s3_class(pkg$isolates$sampleDate, "Date")
  expect_s3_class(pkg$isolates$releasedAt, "POSIXct")
  expect_equal(format(pkg$isolates$releasedAt, tz = "UTC", format = "%H:%M"), c("12:00", "12:00"))
  expect_identical(pkg$isolates$flag, c(TRUE, FALSE))
  expect_identical(pkg$isolates$organism, c("Escherichia coli ä", "NA"))
  expect_length(pkg$fields$isolates, 8L)
  expect_equal(pkg$methods[[1]]$method, "wilson")
  expect_equal(pkg$readme, "Research methods\n")
  expect_output(print(pkg), "isolates: 2 rows x 8 columns")
  expect_null(pkg$missing)
})

test_that("zip and folder give the same package, optional files may be absent", {
  skip_if(Sys.which("zip") == "", "zip executable unavailable")
  fixture <- package_fixture()
  archive <- tempfile(fileext = ".zip")
  on.exit(unlink(c(fixture$root, archive), recursive = TRUE))
  old <- setwd(fixture$root)
  tryCatch(utils::zip(archive, list.files(), flags = "-q", zip = Sys.which("zip")), finally = setwd(old))
  expect_equal(read_package(archive), read_package(fixture$root))
  expect_identical(read_package(archive)$methods, list())
  expect_identical(read_package(archive)$readme, "")
})

test_that("format and unsafe resource paths are rejected", {
  fixture <- package_fixture()
  on.exit(unlink(fixture$root, recursive = TRUE))
  descriptor <- fixture$descriptor
  descriptor$aei$format <- "wrong"
  jsonlite::write_json(descriptor, file.path(fixture$root, "datapackage.json"), auto_unbox = TRUE)
  expect_error(read_package(fixture$root), "aei-package/1")
  descriptor <- fixture$descriptor
  for (path in c("../outside.csv", "/tmp/outside.csv", "C:\\outside.csv", "..\\outside.csv", "folder/../isolates.csv", "")) {
    descriptor$resources[[1]]$path <- path
    jsonlite::write_json(descriptor, file.path(fixture$root, "datapackage.json"), auto_unbox = TRUE)
    expect_error(read_package(fixture$root), "escapes the package")
  }
  outside <- tempfile()
  writeLines("outside", outside)
  on.exit(unlink(outside), add = TRUE)
  unlink(file.path(fixture$root, "isolates.csv"))
  if (file.symlink(outside, file.path(fixture$root, "isolates.csv"))) {
    jsonlite::write_json(fixture$descriptor, file.path(fixture$root, "datapackage.json"), auto_unbox = TRUE)
    expect_error(read_package(fixture$root), "escapes the package")
  }
})

test_that("schema conversion rejects invalid non-missing values", {
  path <- tempfile(fileext = ".csv")
  on.exit(unlink(path))
  cases <- list(integer = "1.5", number = "oops", date = "2025-02-30", datetime = "not-a-date", boolean = "yes")
  for (kind in names(cases)) {
    writeLines(c("value", cases[[kind]]), path)
    expect_error(aei:::.read_table(path, list(list(name = "value", type = kind))), "Invalid")
  }
  writeLines(c("value", "2025-03-01T12:00:00"), path)
  expect_equal(format(aei:::.read_table(path, list(list(name = "value", type = "datetime")))$value,
                      tz = "UTC", format = "%H:%M"), "12:00")
})

test_that("AMR columns prefer schema markers and tolerate missing metadata", {
  frame <- data.frame(AMC = "R", TZP = "S", organism = "Escherichia coli", count = 1L, empty = NA_character_)
  expect_equal(aei:::.amr_columns(frame, list()), c("AMC", "TZP", "empty"))
  fields <- list(list(name = "AMC", type = "string"),
                 list(name = "TZP", title = "Piperacillin", description = "Antibiotic result S/I/R"),
                 list(name = "organism", type = "string"))
  expect_equal(aei:::.amr_columns(frame, fields), "TZP")
  expect_equal(aei:::.amr_columns(frame, list(list(name = "AMC"))), c("AMC", "TZP", "empty"))
})

test_that("as_amr explains its optional dependency or converts result columns", {
  frame <- data.frame(organism = "Escherichia coli", AMC = "R", isolateId = "i1")
  if (!requireNamespace("AMR", quietly = TRUE)) {
    expect_error(as_amr(frame), "install.packages\\('AMR'\\)")
  } else {
    result <- as_amr(frame)
    expect_s3_class(result$AMC, "sir")
    expect_s3_class(result$organism, "mo")
    expect_identical(result$isolateId, "i1")
  }
})
