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

interface UseChallengesOptions {
  /** Polling interval in milliseconds. Set to 0 to disable polling. Default: 0 (disabled) */
  pollingInterval?: number;
}

/**
 * Custom hook for fetching challenges from the API.
 *
 * @param options - Configuration options
 * @param options.pollingInterval - Interval in ms to poll for updates. Default: 0 (disabled)
 * @returns An object containing:
 *   - data: The array of challenges, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 *   - refetch: Function to manually trigger a refetch
 */
export function useChallenges(options: UseChallengesOptions = {}) {
  const { pollingInterval = 0 } = options;

  const [data, setData] = useState<Challenge[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialFetch = useRef(true);

  const fetchChallenges = useCallback(async () => {
    const isFirst = isInitialFetch.current;
    try {
      // Only show loading state for initial fetch
      if (isFirst) {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch("/balancer/api/challenges");

      if (!response.ok) {
        throw new Error(`Failed to fetch challenges: ${response.status}`);
      }

      const result: ChallengesResponse = await response.json();
      setData(result.challenges);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching challenges:", err);
    } finally {
      if (isFirst) {
        setIsLoading(false);
        isInitialFetch.current = false;
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Polling
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const intervalId = setInterval(fetchChallenges, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [pollingInterval, fetchChallenges]);

  return { data, isLoading, error, refetch: fetchChallenges };
}
