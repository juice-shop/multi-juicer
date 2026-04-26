import {
  useHttpLongPoll,
  FetchResult,
  extractLastUpdateTimestamp,
} from "./useHttpLongPoll";

export interface TeamScore {
  name: string;
  score: number;
  position: number;
  solvedChallengeCount: number;
}

/**
 * Fetches the scoreboard data from the backend.
 *
 * @param lastSeen - The timestamp of the last update, or null for initial fetch
 * @param signal - AbortSignal for request cancellation
 * @returns An array of team scores and server timestamp, or null if the server returns 204 (no new data)
 */
async function fetchScoreboard(
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<FetchResult<TeamScore[]>> {
  const url = lastSeen
    ? `/balancer/api/score-board/top?wait-for-update-after=${lastSeen.toISOString()}`
    : "/balancer/api/score-board/top";

  const response = await fetch(url, { signal });

  const lastUpdateTimestamp = extractLastUpdateTimestamp(response);

  // Status 204 No Content means the long-poll timed out without new data
  if (response.status === 204) {
    return { data: null, lastUpdateTimestamp };
  }
  if (!response.ok) {
    throw new Error("Failed to fetch scoreboard data");
  }

  const { teams } = (await response.json()) as { teams: TeamScore[] };
  return { data: teams, lastUpdateTimestamp };
}

/**
 * Custom hook for fetching and polling the scoreboard data.
 *
 * This hook uses HTTP long polling to keep the scoreboard data up-to-date.
 * It automatically handles retries on errors and ensures a minimum of 3 seconds
 * between requests to avoid spamming the server.
 *
 * @returns An object containing:
 *   - data: The array of team scores, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useScoreboard() {
  return useHttpLongPoll<TeamScore[]>({
    fetchFn: fetchScoreboard,
  });
}
