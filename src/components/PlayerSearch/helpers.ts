import { MIN_QUERY_LENGTH } from "./constants";

export interface DebouncedSearchHandlers<T> {
  onLoading(loading: boolean): void;
  onResults(results: T): void;
  onError(): void;
}

export interface DebouncedSearch {
  update(query: string): void;
  cancel(): void;
}

/**
 * Debounces a search and guarantees that only the latest request's outcome is
 * delivered. Each update/cancel bumps a request id; responses (success or
 * error) for an older id are dropped without touching any handler.
 */
export function createDebouncedSearch<T>(
  search: (query: string) => Promise<T>,
  delayMs: number,
  handlers: DebouncedSearchHandlers<T>,
): DebouncedSearch {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestId = 0;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function update(query: string) {
    clearTimer();
    const id = ++latestId;
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      handlers.onLoading(false);
      return;
    }

    handlers.onLoading(true);
    timer = setTimeout(() => {
      timer = null;
      // Wrap so a synchronous throw is treated like a rejection.
      new Promise<T>((resolve) => resolve(search(trimmed))).then(
        (results) => {
          if (id !== latestId) return;
          handlers.onResults(results);
          handlers.onLoading(false);
        },
        () => {
          if (id !== latestId) return;
          handlers.onError();
          handlers.onLoading(false);
        },
      );
    }, delayMs);
  }

  function cancel() {
    clearTimer();
    latestId++;
    handlers.onLoading(false);
  }

  return { update, cancel };
}
