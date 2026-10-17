client_records <- function() list(
  list(isolateId = "i2", sampleDate = "2025-03-03", ward = "URO", organism = "Escherichia coli",
       results = list(TZP = "S", AMC = "R"), phenotypes = list("ESBL", "CPE"), patientId = "p2"),
  list(isolateId = "i1", sampleDate = "2025-03-01", ward = "ICU", organism = "Bactéria",
       results = list(AMC = "S"), phenotypes = list(), patientId = "p1")
)

mock_api <- function() {
  state <- new.env(parent = emptyenv())
  state$calls <- list()
  state$records <- client_records()
  state$project <- list(id = "spring", name = "Spring", description = "ESBL", mode = "frozen",
                        asOf = "2025-03-15", createdAt = "2026-10-17T00:00:00Z", updatedAt = "2026-10-17T00:00:00Z",
                        scope = list(from = "2025-03-01", to = "2025-04-01", site = "tyks", units = list("URO"),
                                     organisms = list("Escherichia coli"), phenotypes = list("ESBL")),
                        fingerprint = fingerprint_rows(state$records[1L]))
  state$fetch <- function(url, headers) {
    state$calls[[length(state$calls) + 1L]] <- list(url = url, headers = headers)
    path <- sub("\\?.*$", "", sub("^https://example.test", "", url))
    status <- 200L
    data <- switch(path,
      "/api/isolates" = list(records = state$records),
      "/api/alerts" = list(alerts = list(list(id = "a1", kind = "cluster"))),
      "/api/weekly" = list(weeks = list("2025-03-03", "2025-03-10"), units = list(
        URO = list(cultures = list(3, 4), phenotypes = list(ESBL = list(1, 2), CPE = list(0, 1))))),
      "/api/clock" = list(asOf = "2025-06-01", playing = FALSE),
      "/api/sites" = list(sites = list(list(id = "tyks", name = "Tyks"))),
      "/api/projects" = list(projects = list(state$project)),
      "/api/projects/spring" = list(project = state$project, drift = FALSE),
      { status <- 404L; list(error = "project not found") }
    )
    list(status = status, body = as.character(jsonlite::toJSON(data, auto_unbox = TRUE)))
  }
  state
}

test_that("isolates flatten antibiotics and phenotypes and retain query names", {
  api <- mock_api()
  local_mocked_bindings(.http_get = api$fetch)
  client <- connect("https://example.test/", token = "secret", site = "tyks")
  expect_s3_class(client, "aei_client")
  frame <- client$isolates(from = "2025-03-01", ward = "URO", ageMin = 0, specimen = NULL)
  expect_equal(frame$isolateId, c("i2", "i1"))
  expect_equal(frame$AMC, c("R", "S"))
  expect_equal(frame$TZP, c("S", NA))
  expect_equal(frame$phenotypes, c("ESBL;CPE", ""))
  expect_equal(frame$phenotype_list[[1]], c("ESBL", "CPE"))
  expect_length(frame$phenotype_list[[2]], 0L)
  expect_false("results" %in% names(frame))
  call <- api$calls[[1L]]
  expect_match(call$url, "from=2025-03-01&ward=URO&ageMin=0&site=tyks", fixed = TRUE)
  expect_identical(unname(call$headers["Authorization"]), "Bearer secret")
  client$isolates(site = "other")
  expect_match(api$calls[[2L]]$url, "site=other", fixed = TRUE)
  client$isolates(site = NULL)
  expect_identical(api$calls[[3L]]$url, "https://example.test/api/isolates")
  expect_output(print(client), "AEI client")
  expect_false(grepl("secret", paste(capture.output(print(client)), collapse = "")))
  api$records <- list()
  expect_equal(client$isolates(), data.frame())
})

test_that("remaining routes return contract shapes and errors include status", {
  api <- mock_api()
  local_mocked_bindings(.http_get = api$fetch)
  client <- connect("https://example.test")
  expect_equal(client$alerts()$id, "a1")
  weekly <- client$weekly(site = "tyks")
  expect_equal(weekly$ward, c("URO", "URO"))
  expect_equal(weekly$cultures, c(3L, 4L))
  expect_equal(weekly$ESBL, c(1L, 2L))
  expect_equal(weekly$CPE, c(0L, 1L))
  expect_equal(client$clock()$playing, FALSE)
  expect_equal(client$sites()[[1L]]$id, "tyks")
  expect_s3_class(client$projects()[[1L]], "aei_project")
  expect_error(client$project("missing /?"), "HTTP 404: project not found", fixed = TRUE)
  expect_match(tail(api$calls, 1)[[1]]$url, "missing%20%2F%3F", fixed = TRUE)
})

test_that("plain HTTP errors include the response text", {
  local_mocked_bindings(.http_get = function(...) list(status = 503L, body = "Unavailable"))
  expect_error(connect("https://example.test")$clock(), "HTTP 503: Unavailable", fixed = TRUE)
})

test_that("frozen verification uses project scope rather than client defaults", {
  api <- mock_api()
  local_mocked_bindings(.http_get = api$fetch)
  client <- connect("https://example.test", site = "ignored-default")
  project <- client$project("spring")
  expect_s3_class(project, "aei_project")
  expect_identical(project$drift, FALSE)
  expect_output(print(project), "Spring")
  expect_true(verify(project, client))
  expect_match(tail(api$calls, 1)[[1]]$url, "from=2025-03-01&to=2025-03-15&site=tyks&ward=URO", fixed = TRUE)
  for (change in list(list(sampleDate = "2025-02-28"), list(sampleDate = "2025-03-20"),
                      list(ward = "OTHER"), list(organism = "Other organism"), list(phenotypes = list()))) {
    extra <- api$records[[1]]
    extra[names(change)] <- change
    extra$isolateId <- "excluded"
    api$records[[length(api$records) + 1L]] <- extra
  }
  expect_true(verify(project))
  api$records <- client_records()
  api$records[[1]]$results$AMC <- "S"
  expect_false(verify(project))
  api$records <- client_records()
  scope <- project$scope
  scope$units <- list("URO", "ICU")
  scope$site <- NULL
  scope$organisms <- list()
  scope$to <- "2025-03-02"
  scope$phenotypes <- list()
  project$scope <- scope
  project$fingerprint <- fingerprint_rows(api$records[2L])
  expect_true(verify(project))
  expect_identical(tail(api$calls, 1)[[1]]$url, "https://example.test/api/isolates?from=2025-03-01&to=2025-03-02")
  project$mode <- "continuous"
  expect_error(verify(project), "Only frozen")
})
