import { useState, useEffect } from "react";

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
 *
 * @returns An object containing:
 *   - data: The array of challenges, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useChallenges() {
  const [data, setData] = useState<Challenge[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChallenges() {
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
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching challenges:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchChallenges();
  }, []);

  return { data, isLoading, error };
}
