// Plain-language question -> filters, the pure part: the prompt and answer
// schema built from the feed's code lists, the model's reply checked against
// those lists again, and relative periods resolved against the feed's as-of
// date. No network here; the caller sends the request. See README.md.

export * from "./questions.ts";
