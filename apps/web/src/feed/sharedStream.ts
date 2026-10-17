// One server-sent event stream for every tab of the app on the same origin.
//
// A browser keeps at most six HTTP/1.1 connections per host, and each
// EventSource holds one open for good: with six tabs open, the seventh tab's
// requests queue behind the streams and it never loads. So the tabs share:
// the tab holding a Web Lock opens the one EventSource and passes every event
// on over a BroadcastChannel; the other tabs listen on the channel and wait
// for the lock. When the leading tab closes, the browser releases its lock,
// the next tab takes it and opens the stream. Where BroadcastChannel or Web
// Locks are missing, each tab opens its own stream as before.

export interface StreamEvent {
  type: string;
  data: string;
}

/** The browser objects the stream needs; tests pass fakes. */
export interface StreamEnv {
  EventSource: new (url: string) => Pick<EventSource, "addEventListener" | "close"> & { onerror: ((e: Event) => void) | null };
  BroadcastChannel?: new (
    name: string,
  ) => Pick<BroadcastChannel, "postMessage" | "close"> & { onmessage: ((e: MessageEvent) => void) | null };
  locks?: Pick<LockManager, "request">;
}

type Message = { kind: "event"; event: StreamEvent } | { kind: "error" };

function browserEnv(): StreamEnv {
  return {
    EventSource: globalThis.EventSource,
    BroadcastChannel: typeof globalThis.BroadcastChannel === "function" ? globalThis.BroadcastChannel : undefined,
    locks: typeof navigator !== "undefined" && navigator.locks ? navigator.locks : undefined,
  };
}

/**
 * Listen to `types` on the stream at `url`, shared with other tabs when the
 * browser allows. `onError` fires when the stream fails (in whichever tab
 * holds it). Returns a function that stops listening (and, in the leading
 * tab, closes the stream and hands it on).
 */
export function subscribeShared(
  url: string,
  types: readonly string[],
  onEvent: (event: StreamEvent) => void,
  onError?: () => void,
  env: StreamEnv = browserEnv(),
): () => void {
  if (!env.BroadcastChannel || !env.locks) return subscribeOwn(url, types, onEvent, onError, env);

  const name = `aei-stream:${url}`;
  const channel = new env.BroadcastChannel(name);
  const stop = new AbortController();
  let release: (() => void) | null = null;
  let source: InstanceType<StreamEnv["EventSource"]> | null = null;
  let closed = false;

  channel.onmessage = (e: MessageEvent) => {
    const message = e.data as Message;
    if (message.kind === "event") onEvent(message.event);
    else onError?.();
  };

  env.locks
    .request(name, { signal: stop.signal }, () => {
      if (closed) return undefined;
      source = new env.EventSource(url);
      for (const type of types)
        source.addEventListener(type, (e) => {
          const event = { type, data: (e as MessageEvent<string>).data };
          onEvent(event);
          channel.postMessage({ kind: "event", event } satisfies Message);
        });
      source.onerror = () => {
        channel.postMessage({ kind: "error" } satisfies Message);
        onError?.();
      };
      // Hold the lock until this tab stops listening.
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    })
    .catch(() => {}); // aborted while waiting for the lock

  return () => {
    closed = true;
    source?.close();
    source = null;
    release?.();
    stop.abort();
    channel.onmessage = null;
    channel.close();
  };
}

function subscribeOwn(
  url: string,
  types: readonly string[],
  onEvent: (event: StreamEvent) => void,
  onError: (() => void) | undefined,
  env: StreamEnv,
): () => void {
  const source = new env.EventSource(url);
  for (const type of types) source.addEventListener(type, (e) => onEvent({ type, data: (e as MessageEvent<string>).data }));
  if (onError) source.onerror = onError;
  return () => source.close();
}
