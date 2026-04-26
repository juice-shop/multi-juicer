import { useState, useEffect, useCallback, useRef } from "react";

export interface Challenge {
  key: string;
  name: string;
  category: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  solveCount: number;
  firstSolver?: string | null;
}

interface ChallengesResponse {
  challenges: Challenge[];
}

/**
 * Custom hook for fetching challenges from the API.
 * Challenges are fetched once on mount. Solve counts and first-solver data
 * are updated incrementally via `applySolveEvent` (driven by the activity feed).
 *
 * @returns An object containing:
 *   - data: The array of challenges, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 *   - refetch: Function to manually trigger a refetch
 *   - applySolveEvent: Function to incrementally update solve data
 */
export function useChallenges() {
  const [data, setData] = useState<Challenge[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/balancer/api/challenges");

      if (!response.ok) {
        throw new Error(`Failed to fetch challenges: ${response.status}`);
      }

      const result: ChallengesResponse = await response.json();
      setData(result.challenges);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching challenges:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const appliedSolvesRef = useRef(new Set<string>());

  const applySolveEvent = useCallback(
    (challengeKey: string, solver: string, isFirstSolve: boolean) => {
      const dedupeKey = `${challengeKey}:${solver}`;
      if (appliedSolvesRef.current.has(dedupeKey)) return;
      appliedSolvesRef.current.add(dedupeKey);

      setData((prev) => {
        if (!prev) return prev;
        return prev.map((challenge) => {
          if (challenge.key !== challengeKey) return challenge;
          return {
            ...challenge,
            solveCount: challenge.solveCount + 1,
            firstSolver: isFirstSolve ? solver : challenge.firstSolver,
          };
        });
      });
    },
    []
  );

  return { data, isLoading, error, refetch: fetchChallenges, applySolveEvent };
}
