import "@testing-library/jest-dom";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useHttpLongPoll } from "./useHttpLongPoll";

describe("useHttpLongPoll", () => {
  afterEach(() => {
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

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(fetchFn).toHaveBeenCalledWith(null, expect.any(AbortSignal));

    unmount();
  });

  test("should handle 204 no content (null response)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: null });

    const { result, unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

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

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.data).toBe(null);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    unmount();
  });

  test("should recover from errors on retry", async () => {
    const error = new Error("Network error");
    const mockData = "test";
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ data: mockData });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result, unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        errorRetryDelay: 500, // Faster retry for test
      })
    );

    await waitFor(() => {
      expect(result.current.error).toBe("Network error");
    });

    // Wait for retry (will happen after errorRetryDelay)
    await waitFor(
      () => {
        expect(result.current.error).toBe(null);
      },
      { timeout: 2000 }
    );

    expect(result.current.data).toEqual(mockData);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
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

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not set error state for AbortError
    expect(result.current.error).toBe(null);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    unmount();
    consoleErrorSpy.mockRestore();
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

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

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

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

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

    // Wait a bit to ensure it doesn't call
    await new Promise((resolve) => setTimeout(resolve, 200));

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

    // Wait for the async fetch to complete before unmounting
    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

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

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    unmount();

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test("should abort ongoing request on unmount", async () => {
    let capturedSignal: AbortSignal | null = null;
    const fetchFn = vi.fn().mockImplementation((_lastSeen, signal) => {
      capturedSignal = signal;
      return new Promise((resolve) =>
        setTimeout(() => resolve({ data: "test" }), 10000)
      );
    });

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    expect(capturedSignal).not.toBe(null);
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  test("should clear timeout on unmount", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

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
        calculateWaitTime: () => 200, // Faster polling for test
      })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData1);
    });

    // Wait for next poll
    await waitFor(
      () => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      },
      { timeout: 2000 }
    );

    // Data should remain the same when server returns null
    expect(result.current.data).toEqual(mockData1);

    unmount();
  });

  test("should pass null to fetchFn on first call", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    const firstCall = fetchFn.mock.calls[0];
    expect(firstCall[0]).toBe(null);

    unmount();
  });

  test("should pass Date timestamp to fetchFn on subsequent polls", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { unmount } = renderHook(() =>
      useHttpLongPoll({
        fetchFn,
        calculateWaitTime: () => 100, // Short wait for faster test
      })
    );

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    const firstCall = fetchFn.mock.calls[0];
    expect(firstCall[0]).toBe(null);

    // Wait for second poll
    await waitFor(
      () => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      },
      { timeout: 5000 }
    );

    const secondCall = fetchFn.mock.calls[1];
    expect(secondCall[0]).toBeInstanceOf(Date);

    unmount();
  });

  test("should pass AbortSignal to fetchFn", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "test" });

    const { unmount } = renderHook(() => useHttpLongPoll({ fetchFn }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    expect(fetchFn).toHaveBeenCalledWith(null, expect.any(AbortSignal));

    unmount();
  });
});
