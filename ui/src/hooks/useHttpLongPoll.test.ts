import "@testing-library/jest-dom";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { flushPromises } from "./test-helpers";
import { useHttpLongPoll } from "./useHttpLongPoll";

describe("useHttpLongPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("should start in loading state", () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { result, unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);

    unmount();
  });

  test("should fetch data on mount and update state", async () => {
    const mockData = "test";
    const fetchFn = vi.fn().mockResolvedValue({ data: mockData });

    const { result, unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await flushPromises();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(fetchFn).toHaveBeenCalledWith(null, expect.any(AbortSignal));

    unmount();
  });

  test("should handle 204 no content (null response)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: null });

    const { result, unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await flushPromises();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    unmount();
  });

  test("should handle errors and set error state", async () => {
    const error = new Error("Network error");
    const fetchFn = vi.fn().mockRejectedValue(error);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await flushPromises();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Network error");
    expect(result.current.data).toBe(null);
    expect(consoleErrorSpy).toHaveBeenCalled();

    unmount();
  });

  test("should recover from errors on retry", async () => {
    const error = new Error("Network error");
    const mockData = "test";
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ data: mockData });

    vi.spyOn(console, "error").mockImplementation(() => {});

    const errorRetryDelay = 500;
    const { result, unmount } = renderHook(() =>
      useHttpLongPoll({ fetchFn, errorRetryDelay })
    );

    // First fetch rejects → error state set, retry timer scheduled
    await flushPromises();
    expect(result.current.error).toBe("Network error");

    // Advance past errorRetryDelay → retry runs and resolves
    await act(async () => {
      await vi.advanceTimersByTimeAsync(errorRetryDelay);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.data).toEqual(mockData);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    unmount();
  });

  test("should ignore AbortError", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    const fetchFn = vi.fn().mockRejectedValue(abortError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    // Flush microtasks so the rejection is handled
    await flushPromises();

    // Should not set error state for AbortError
    expect(result.current.error).toBe(null);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    unmount();
  });

  test("should use custom calculateWaitTime function", async () => {
    const mockData = "test";
    const fetchFn = vi.fn().mockResolvedValue({ data: mockData });
    const calculateWaitTime = vi.fn().mockReturnValue(100);

    const { unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        calculateWaitTime,
      })
    );

    await flushPromises();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(calculateWaitTime).toHaveBeenCalledWith(expect.any(Date), mockData);

    unmount();
  });

  test("should call calculateWaitTime with null when response is null", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: null });
    const calculateWaitTime = vi.fn().mockReturnValue(100);

    const { unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        calculateWaitTime,
      })
    );

    await flushPromises();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(calculateWaitTime).toHaveBeenCalledWith(expect.any(Date), null);

    unmount();
  });

  test("should not poll when enabled is false", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { result, unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        enabled: false,
      })
    );

    // Advance time well past any plausible poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(null);

    unmount();
  });

  test("should call onStart when polling starts", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });
    const onStart = vi.fn();

    const { unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        onStart,
      })
    );

    expect(onStart).toHaveBeenCalledTimes(1);

    // Let pending fetch resolve before unmounting
    await flushPromises();
    expect(fetchFn).toHaveBeenCalled();

    unmount();
  });

  test("should call onStop when polling stops (unmount)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });
    const onStop = vi.fn();

    const { unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        onStop,
      })
    );

    await flushPromises();
    expect(fetchFn).toHaveBeenCalled();

    unmount();

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test("should abort ongoing request on unmount", async () => {
    const signalRef: { current: AbortSignal | null } = { current: null };
    const fetchFn = vi
      .fn()
      .mockImplementation((_lastSeen, signal: AbortSignal) => {
        signalRef.current = signal;
        return new Promise((resolve) =>
          setTimeout(() => resolve({ data: "test" }), 10000)
        );
      });

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    // Let the fetch start (but its setTimeout hasn't fired yet under fake timers)
    await flushPromises();
    expect(fetchFn).toHaveBeenCalled();

    expect(signalRef.current).not.toBe(null);
    expect(signalRef.current?.aborted).toBe(false);

    unmount();

    expect(signalRef.current?.aborted).toBe(true);
  });

  test("should clear timeout on unmount", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await flushPromises();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  test("should keep previous data on null response", async () => {
    const mockData1 = "test1";
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ data: mockData1 })
      .mockResolvedValueOnce({ data: null });

    const { result, unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        calculateWaitTime: () => 200,
      })
    );

    // First fetch resolves with data
    await flushPromises();
    expect(result.current.data).toEqual(mockData1);

    // Advance past the 200ms wait so the second poll runs
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    // Data should remain the same when server returns null
    expect(result.current.data).toEqual(mockData1);

    unmount();
  });

  test("should pass null to fetchFn on first call", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await flushPromises();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const firstCall = fetchFn.mock.calls[0];
    expect(firstCall[0]).toBe(null);

    unmount();
  });

  test("should pass Date timestamp to fetchFn on subsequent polls", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        calculateWaitTime: () => 100,
      })
    );

    await flushPromises();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const firstCall = fetchFn.mock.calls[0];
    expect(firstCall[0]).toBe(null);

    // Advance past the 100ms wait so the second poll runs
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const secondCall = fetchFn.mock.calls[1];
    expect(secondCall[0]).toBeInstanceOf(Date);

    unmount();
  });

  test("should pass AbortSignal to fetchFn", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await flushPromises();
    expect(fetchFn).toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledWith(null, expect.any(AbortSignal));

    unmount();
  });
});
