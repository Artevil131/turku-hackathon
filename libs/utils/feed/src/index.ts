// The data feed AEI reads: its format (types.ts), types only, so the engine
// gears can use it without the DOM. The browser client over HTTP and
// server-sent events is the subpath "@aei/feed/http" (http.ts). See README.md.

export type {
  Antibiotic,
  AskAnswer,
  Feed,
  FeedClock,
  FeedCommand,
  FeedEvent,
  FeedMeta,
  IsoDate,
  Named,
  Result,
  SR,
  Unit,
} from "./types.ts";
