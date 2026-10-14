import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncedSearch } from "../components/PlayerSearch/helpers";
import { SEARCH_DEBOUNCE_MS } from "../components/PlayerSearch/constants";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(err: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const pending: Deferred<string[]>[] = [];
  const search = vi.fn((q: string) => {
    void q;
    const d = deferred<string[]>();
    pending.push(d);
    return d.promise;
  });
  const events: string[] = [];
  const handlers = {
    onLoading: vi.fn((loading: boolean) => {
      events.push(`loading:${loading}`);
    }),
    onResults: vi.fn((r: string[]) => {
      events.push(`results:${r.join(",")}`);
    }),
    onError: vi.fn(() => {
      events.push("error");
    }),
  };
  const controller = createDebouncedSearch(search, SEARCH_DEBOUNCE_MS, handlers);
  const lastLoading = () => handlers.onLoading.mock.calls.at(-1)?.[0];
  return { search, pending, handlers, controller, events, lastLoading };
}

// Let promise callbacks run.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createDebouncedSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears loading when query drops below min length before debounce fires", () => {
    const { search, controller, lastLoading } = setup();
    controller.update("me");
    expect(lastLoading()).toBe(true);
    vi.advanceTimersByTime(100);
    controller.update("m");
    expect(lastLoading()).toBe(false);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
    expect(search).not.toHaveBeenCalled();
    expect(lastLoading()).toBe(false);
  });

  it("ignores in-flight response after query is cleared", async () => {
    const { search, pending, handlers, controller, lastLoading } = setup();
    controller.update("messi");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(1);

    controller.update("");
    expect(lastLoading()).toBe(false);
    const loadingCalls = handlers.onLoading.mock.calls.length;

    pending[0].resolve(["Messi"]);
    await flush();
    expect(handlers.onResults).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(handlers.onLoading).toHaveBeenCalledTimes(loadingCalls);
    expect(lastLoading()).toBe(false);
  });

  it("drops stale response that resolves after a newer one", async () => {
    const { search, pending, handlers, controller, events } = setup();
    controller.update("mes");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    controller.update("messi");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenNthCalledWith(1, "mes");
    expect(search).toHaveBeenNthCalledWith(2, "messi");

    pending[1].resolve(["Lionel Messi"]);
    await flush();
    pending[0].resolve(["Mesut Ozil", "Lionel Messi"]);
    await flush();

    expect(handlers.onResults).toHaveBeenCalledTimes(1);
    expect(handlers.onResults).toHaveBeenCalledWith(["Lionel Messi"]);
    expect(events.at(-2)).toBe("results:Lionel Messi");
    expect(events.at(-1)).toBe("loading:false");
  });

  it("ignores stale rejection", async () => {
    const { pending, handlers, controller, lastLoading } = setup();
    controller.update("mes");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    controller.update("messi");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(lastLoading()).toBe(true);

    pending[0].reject(new Error("network"));
    await flush();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(lastLoading()).toBe(true);

    pending[1].resolve(["Lionel Messi"]);
    await flush();
    expect(handlers.onResults).toHaveBeenCalledWith(["Lionel Messi"]);
    expect(lastLoading()).toBe(false);
  });

  it("reports error for latest request", async () => {
    const { pending, handlers, controller, events } = setup();
    controller.update("messi");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    pending[0].reject(new Error("network"));
    await flush();

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onResults).not.toHaveBeenCalled();
    expect(events).toEqual(["loading:true", "error", "loading:false"]);
  });

  it("debounces to a single call with trimmed final query", () => {
    const { search, controller } = setup();
    for (const q of ["me", "mes", "mess", "messi", "  messi  "]) {
      controller.update(q);
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50);
    }
    expect(search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("messi");
  });

  it("cancel prevents pending and in-flight results", async () => {
    const { search, pending, handlers, controller, lastLoading } = setup();

    // Pending timer: never fires after cancel.
    controller.update("messi");
    controller.cancel();
    expect(lastLoading()).toBe(false);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
    expect(search).not.toHaveBeenCalled();

    // In-flight request: response ignored after cancel.
    controller.update("ronaldo");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(1);
    controller.cancel();
    expect(lastLoading()).toBe(false);
    const loadingCalls = handlers.onLoading.mock.calls.length;

    pending[0].resolve(["Cristiano Ronaldo"]);
    await flush();
    expect(handlers.onResults).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(handlers.onLoading).toHaveBeenCalledTimes(loadingCalls);
  });

  it("treats a synchronous throw from search as an error", async () => {
    const onError = vi.fn();
    const onLoading = vi.fn();
    const controller = createDebouncedSearch(
      () => {
        throw new Error("boom");
      },
      SEARCH_DEBOUNCE_MS,
      { onLoading, onResults: vi.fn(), onError },
    );
    controller.update("messi");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onLoading).toHaveBeenLastCalledWith(false);
  });
});
