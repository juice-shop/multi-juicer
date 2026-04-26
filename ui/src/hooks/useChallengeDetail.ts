import { useState, useEffect } from "react";

interface ChallengeSolveResponse {
  team: string;
  solvedAt: string; // ISO string
}

interface ChallengeDetailDataResponse {
  key: string;
  name: string;
  category: string;
  description: string;
  difficulty: number;
  solves: ChallengeSolveResponse[];
}

export interface ChallengeSolve extends Omit<
  ChallengeSolveResponse,
  "solvedAt"
> {
  solvedAt: Date; // Convert string to Date object
}

export interface ChallengeDetail {
  key: string;
  name: string;
  category: string;
  description: string;
  difficulty: number;
  solves: ChallengeSolve[];
}

/**
 * Custom hook for fetching challenge details including solve information.
 *
 * @param challengeKey - The unique key of the challenge to fetch
 * @returns An object containing:
 *   - data: The challenge detail with solves, or null if not yet loaded
 *   - isLoading: True during the fetch
 *   - error: Error message if the fetch failed, or null
 */
export function useChallengeDetail(challengeKey: string | null) {
  const [data, setData] = useState<ChallengeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeKey) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    async function fetchChallengeDetail() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/balancer/api/challenges/${challengeKey}`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch challenge detail: ${response.status}`
          );
        }

        const result: ChallengeDetailDataResponse = await response.json();

        // Convert ISO string dates to Date objects
        const detail: ChallengeDetail = {
          ...result,
          solves: result.solves.map((solve) => ({
            team: solve.team,
            solvedAt: new Date(solve.solvedAt),
          })),
        };

        setData(detail);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching challenge detail:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchChallengeDetail();
  }, [challengeKey]);

  return { data, isLoading, error };
}
