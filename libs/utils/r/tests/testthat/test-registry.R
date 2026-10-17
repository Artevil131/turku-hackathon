test_that("the bundled registry exposes live definitions without porting methods", {
  registry <- methods_registry()
  expect_length(registry, 14)
  ids <- vapply(registry, function(entry) entry$id, character(1))
  expect_true(all(c("profileExcess", "coverage", "suggestCombinations", "isolates", "patients", "alerts") %in% ids))
  expect_equal(length(unique(ids)), length(ids))
  expect_equal(registry[[which(ids == "coverage")]]$gear$module, "@aei/coverage")
  source <- testthat::test_path("..", "..", "..", "methods", "registry.json")
  expect_identical(readBin(system.file("registry.json", package = "aei"), "raw", n = 1000000),
                   readBin(source, "raw", n = 1000000))
})
