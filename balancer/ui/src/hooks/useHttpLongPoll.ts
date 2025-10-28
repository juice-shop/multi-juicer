import { useEffect, useRef, useState } from "react";

export interface HttpLongPollOptions<T> {
  /**
   * The fetch function that performs the HTTP request.
   * Should return null if the server returns 204 (no new data).
   * @param lastSeen - The timestamp of the last successful update, or null for the initial fetch
   * @param signal - AbortSignal for cancellation
   */
  fetchFn: (lastSeen: Date | null, signal: AbortSignal) => Promise<T | null>;

  /**
   * Function to calculate the wait time before the next poll.
   * @param lastUpdateStarted - Timestamp when the last update started
   * @param data - The data returned from the last fetch (null if 204 was returned)
   * @returns The number of milliseconds to wait before the next poll
   */
  calculateWaitTime?: (lastUpdateStarted: Date, data: T | null) => number;

  /**
   * The delay in milliseconds before retrying after an error.
   * @default 5000
   */
  errorRetryDelay?: number;

  /**
   * Called when polling starts (on mount or when dependencies change).
   */
  onStart?: () => void;

  /**
   * Called when polling stops (on unmount or when dependencies change).
   */
  onStop?: () => void;

  /**
   * Whether to enable polling. If false, polling will not start.
   * @default true
   */
  enabled?: boolean;
}

export interface HttpLongPollResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Default wait time calculation: ensures at least 3 seconds between requests,
 * with a target interval of 5 seconds.
 */
function defaultCalculateWaitTime(lastUpdateStarted: Date): number {
  return Math.max(3000, 5000 - (Date.now() - lastUpdateStarted.getTime()));
}

/**
 * A reusable hook for HTTP long polling.
 *
 * This hook manages the lifecycle of long-polling requests, including:
 * - Automatic retry on errors
 * - AbortController management for cleanup
 * - Configurable wait time between polls
 * - Loading and error states
 *
 * @template T - The type of data returned by the fetch function
 * @param options - Configuration options for the long polling behavior
 * @returns An object containing the current data, loading state, and error state
 */
export function useHttpLongPoll<T>(
  options: HttpLongPollOptions<T>
): HttpLongPollResult<T> {
  const {
    fetchFn,
    calculateWaitTime = defaultCalculateWaitTime,
    errorRetryDelay = 5000,
    onStart,
    onStop,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  // Using useRef to make the polling function stable across re-renders
  const pollRef = useRef<
    | ((
        lastSuccessfulUpdate: Date | null,
        signal: AbortSignal
      ) => Promise<void>)
    | null
  >(null);

  pollRef.current = async (
    lastSuccessfulUpdate: Date | null,
    signal: AbortSignal
  ) => {
    try {
      const lastUpdateStarted = new Date();
      const newData = await fetchFn(lastSuccessfulUpdate, signal);

      if (newData !== null) {
        setData(newData);
      }
      setIsLoading(false);
      setError(null);

      // Schedule the next poll
      const waitTime = calculateWaitTime(lastUpdateStarted, newData);
      timeoutRef.current = window.setTimeout(() => {
        pollRef.current?.(new Date(), signal);
      }, waitTime);
    } catch (err) {
      // Ignore abort errors - these are expected when the component unmounts
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("Long polling fetch error:", err);

      setIsLoading(false);
      setError(err instanceof Error ? err.message : "Unknown error");

      // Retry after a delay on error
      timeoutRef.current = window.setTimeout(() => {
        pollRef.current?.(lastSuccessfulUpdate, signal);
      }, errorRetryDelay);
    }
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const abortController = new AbortController();

    // Start polling
    onStart?.();
    pollRef.current?.(null, abortController.signal);

    // Cleanup function to stop polling
    return () => {
      onStop?.();
      abortController.abort();
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, onStart, onStop]);

  return { data, isLoading, error };
}
