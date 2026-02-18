import "@testing-library/jest-dom";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useChallenges } from "./useChallenges";

const mockChallenges = [
  {
    key: "sqlInjectionChallenge",
    name: "SQL Injection",
    category: "Injection",
    description: "A SQL injection challenge",
    difficulty: 2,
    solveCount: 0,
    firstSolver: null,
  },
  {
    key: "xssChallenge",
    name: "XSS",
    category: "XSS",
    description: "A XSS challenge",
    difficulty: 3,
    solveCount: 0,
    firstSolver: null,
  },
];

function mockFetchSuccess() {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ challenges: mockChallenges }),
  } as Response);
}

describe("useChallenges", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("should fetch challenges on mount", async () => {
    mockFetchSuccess();

    const { result } = renderHook(() => useChallenges());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].key).toBe("sqlInjectionChallenge");
  });

  test("applySolveEvent increments solveCount for a new solve", async () => {
    mockFetchSuccess();

    const { result } = renderHook(() => useChallenges());

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    act(() => {
      result.current.applySolveEvent("sqlInjectionChallenge", "team-a", true);
    });

    const challenge = result.current.data!.find(
      (c) => c.key === "sqlInjectionChallenge"
    );
    expect(challenge!.solveCount).toBe(1);
    expect(challenge!.firstSolver).toBe("team-a");
  });

  test("applySolveEvent does NOT double-count the same team solving the same challenge", async () => {
    mockFetchSuccess();

    const { result } = renderHook(() => useChallenges());

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    act(() => {
      result.current.applySolveEvent("sqlInjectionChallenge", "team-a", true);
    });
    act(() => {
      result.current.applySolveEvent("sqlInjectionChallenge", "team-a", true);
    });

    const challenge = result.current.data!.find(
      (c) => c.key === "sqlInjectionChallenge"
    );
    expect(challenge!.solveCount).toBe(1);
  });

  test("applySolveEvent counts different teams solving the same challenge", async () => {
    mockFetchSuccess();

    const { result } = renderHook(() => useChallenges());

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    act(() => {
      result.current.applySolveEvent("sqlInjectionChallenge", "team-a", true);
    });
    act(() => {
      result.current.applySolveEvent("sqlInjectionChallenge", "team-b", false);
    });

    const challenge = result.current.data!.find(
      (c) => c.key === "sqlInjectionChallenge"
    );
    expect(challenge!.solveCount).toBe(2);
  });

  test("applySolveEvent sets firstSolver only on isFirstSolve=true and does not overwrite", async () => {
    mockFetchSuccess();

    const { result } = renderHook(() => useChallenges());

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    act(() => {
      result.current.applySolveEvent("sqlInjectionChallenge", "team-a", true);
    });
    act(() => {
      result.current.applySolveEvent("sqlInjectionChallenge", "team-b", false);
    });

    const challenge = result.current.data!.find(
      (c) => c.key === "sqlInjectionChallenge"
    );
    expect(challenge!.firstSolver).toBe("team-a");
  });
});
