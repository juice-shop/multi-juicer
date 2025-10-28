import { useEffect } from "react";

import { useHttpLongPoll } from "./useHttpLongPoll";

export interface TeamStatus {
  name: string;
  score: string;
  position: number;
  totalTeams: number;
  solvedChallenges: number;
  readiness: boolean;
}

/**
 * Fetches the current team's status from the backend.
 *
 * @param lastSeen - The timestamp of the last update, or null for initial fetch
 * @param signal - AbortSignal for request cancellation
 * @returns The team status data, or null if the server returns 204 (no new data)
 */
async function fetchTeamStatus(
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<TeamStatus | null> {
  const url = lastSeen
    ? `/balancer/api/teams/status?wait-for-update-after=${lastSeen.toISOString()}`
    : "/balancer/api/teams/status";

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error("Failed to fetch current teams");
  }
  if (response.status === 204) {
    return null;
  }
  const status = (await response.json()) as TeamStatus;
  return status;
}

export interface UseTeamStatusOptions {
  /**
   * Callback function that is called when the team status is updated.
   * Receives the team name from the status response.
   */
  onTeamUpdate?: (teamName: string) => void;
}

/**
 * Custom hook for fetching and polling the current team's status.
 *
 * This hook uses HTTP long polling to keep the team status up-to-date.
 * It polls faster when the instance is not ready (1 second) to provide
 * quick feedback during instance startup, and slower when ready (5 seconds).
 *
 * @param options - Configuration options including callback for team updates
 * @returns An object containing:
 *   - data: The team status data, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useTeamStatus(options?: UseTeamStatusOptions) {
  const { onTeamUpdate } = options || {};

  const result = useHttpLongPoll<TeamStatus>({
    fetchFn: fetchTeamStatus,
    calculateWaitTime: (_lastUpdateStarted, data) => {
      // Poll faster when instance is not ready, as it's starting and we want
      // to show the user the status as soon as possible
      if (data === null) {
        // No update from server, wait a bit before retrying
        return 1000;
      }
      return data.readiness ? 5000 : 1000;
    },
  });

  // Call the onTeamUpdate callback when the team name changes
  useEffect(() => {
    if (result.data?.name && onTeamUpdate) {
      onTeamUpdate(result.data.name);
    }
  }, [result.data?.name, onTeamUpdate]);

  return result;
}
