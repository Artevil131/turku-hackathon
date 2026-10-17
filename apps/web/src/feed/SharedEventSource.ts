import { subscribeShared } from "./sharedStream.ts";

/**
 * An EventSource look-alike for `createAeiClient({ EventSource })`: every tab of the app on one origin shares a
 * single server-sent stream (sharedStream.ts), so a seventh tab does not queue behind six open streams.
 * It supports what the client uses: addEventListener, onerror and close.
 */
export class SharedEventSource {
  onerror: ((e: Event) => void) | null = null;
  private listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  private stop: (() => void) | null = null;
  private closed = false;

  constructor(url: string) {
    // The client adds its listeners right after constructing; subscribe once it has named every event type.
    queueMicrotask(() => {
      if (this.closed) return;
      this.stop = subscribeShared(
        url,
        [...this.listeners.keys()],
        (event) => {
          for (const l of this.listeners.get(event.type) ?? []) l(new MessageEvent(event.type, { data: event.data }));
        },
        () => this.onerror?.(new Event("error")),
      );
    });
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
    this.stop?.();
    this.stop = null;
  }
}
