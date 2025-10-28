import { useHttpLongPoll } from "./useHttpLongPoll";

interface SolvedChallengeResponse {
  key: string;
  name: string;
  difficulty: number;
  solvedAt: string; // ISO string
}

interface IndividualTeamScoreResponse {
  name: string;
  score: number;
  position: number;
  totalTeams: number;
  solvedChallenges: SolvedChallengeResponse[];
}

export interface SolvedChallenge
  extends Omit<SolvedChallengeResponse, "solvedAt"> {
  solvedAt: Date; // Convert string to Date object
}

export interface IndividualTeamScore
  extends Omit<IndividualTeamScoreResponse, "solvedChallenges"> {
  solvedChallenges: SolvedChallenge[];
}

/**
 * Fetches the score data for a specific team from the backend.
 *
 * @param team - The name of the team to fetch
 * @param lastSeen - The timestamp of the last update, or null for initial fetch
 * @param signal - AbortSignal for request cancellation
 * @returns The team score data, or null if the server returns 204 (no new data)
 */
async function fetchTeamScore(
  team: string,
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<IndividualTeamScore | null> {
  const url = lastSeen
    ? `/balancer/api/score-board/teams/${team}/score?wait-for-update-after=${lastSeen.toISOString()}`
    : `/balancer/api/score-board/teams/${team}/score`;

  const response = await fetch(url, { signal });

  if (response.status === 204) {
    // No new data from long-poll
    return null;
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Team not found");
    }
    throw new Error("Failed to fetch team score");
  }
  const rawScore = (await response.json()) as IndividualTeamScoreResponse;

  // Process the raw response to convert date strings to Date objects and sort
  return {
    ...rawScore,
    solvedChallenges: rawScore.solvedChallenges
      .map((challenge) => ({
        ...challenge,
        solvedAt: new Date(challenge.solvedAt),
      }))
      .sort((a, b) => b.solvedAt.getTime() - a.solvedAt.getTime()), // Sort by most recent first
  };
}

/**
 * Custom hook for fetching and polling a specific team's score data.
 *
 * This hook uses HTTP long polling to keep the team score data up-to-date.
 * It automatically handles retries on errors and ensures a minimum of 3 seconds
 * between requests to avoid spamming the server.
 *
 * @param team - The name of the team to fetch. If null or undefined, polling is disabled.
 * @returns An object containing:
 *   - data: The team score data, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useTeamScore(team: string | null | undefined) {
  const fetchFn = team
    ? (lastSeen: Date | null, signal: AbortSignal) =>
        fetchTeamScore(team, lastSeen, signal)
    : async () => null;

  return useHttpLongPoll<IndividualTeamScore>({
    fetchFn,
    enabled: !!team,
  });
}
