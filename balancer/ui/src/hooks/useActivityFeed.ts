import {
  useHttpLongPoll,
  FetchResult,
  extractLastUpdateTimestamp,
} from "./useHttpLongPoll";

export interface ActivityEvent {
  team: string;
  challengeKey: string;
  challengeName: string;
  points: number;
  solvedAt: string; // ISO String
  isFirstSolve: boolean;
}

/**
 * Fetches the activity feed data from the backend.
 *
 * @param lastSeen - The timestamp of the last update, or null for initial fetch
 * @param signal - AbortSignal for request cancellation
 * @returns An array of activity events and server timestamp, or null if the server returns 204 (no new data)
 */
async function fetchActivityFeed(
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<FetchResult<ActivityEvent[]>> {
  const url = lastSeen
    ? `/balancer/api/activity-feed?wait-for-update-after=${lastSeen.toISOString()}`
    : "/balancer/api/activity-feed";

  const response = await fetch(url, { signal });

  const lastUpdateTimestamp = extractLastUpdateTimestamp(response);

  // Status 204 No Content means the long-poll timed out without new data
  if (response.status === 204) {
    return { data: null, lastUpdateTimestamp };
  }
  if (!response.ok) {
    throw new Error("Failed to fetch activity feed");
  }

  const data = await response.json();
  return { data, lastUpdateTimestamp };
}

/**
 * Custom hook for fetching and polling the activity feed data.
 *
 * This hook uses HTTP long polling to keep the activity feed up-to-date.
 * It automatically handles retries on errors and ensures a minimum of 3 seconds
 * between requests to avoid spamming the server.
 *
 * @returns An object containing:
 *   - data: The array of activity events, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useActivityFeed() {
  return useHttpLongPoll<ActivityEvent[]>({
    fetchFn: fetchActivityFeed,
  });
}
