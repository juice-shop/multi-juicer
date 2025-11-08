import { useEffect } from "react";

import { useHttpLongPoll } from "./useHttpLongPoll";

interface SolvedChallengeResponse {
  key: string;
  name: string;
  difficulty: number;
  solvedAt: string; // ISO string
}

export interface SolvedChallenge
  extends Omit<SolvedChallengeResponse, "solvedAt"> {
  solvedAt: Date; // Convert string to Date object
}

interface TeamStatusResponse {
  name: string;
  score: number;
  position: number;
  totalTeams: number;
  solvedChallenges: SolvedChallengeResponse[];
  readiness: boolean;
}

export interface TeamStatus
  extends Omit<TeamStatusResponse, "solvedChallenges"> {
  solvedChallenges: SolvedChallenge[];
}

/**
 * Fetches the team status from the backend.
 *
 * @param team - The name of the team to fetch, or "me" for current logged-in team
 * @param lastSeen - The timestamp of the last update, or null for initial fetch
 * @param signal - AbortSignal for request cancellation
 * @returns The team status data, or null if the server returns 204 (no new data)
 */
async function fetchTeamStatus(
  team: "me" | string,
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<TeamStatus | null> {
  const url = lastSeen
    ? `/balancer/api/teams/${team}/status?wait-for-update-after=${lastSeen.toISOString()}`
    : `/balancer/api/teams/${team}/status`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Team not found");
    }
    throw new Error("Failed to fetch team status");
  }
  if (response.status === 204) {
    return null;
  }
  const rawStatus = (await response.json()) as TeamStatusResponse;

  // Process the raw response to convert date strings to Date objects and sort
  return {
    ...rawStatus,
    solvedChallenges: rawStatus.solvedChallenges
      .map((challenge) => ({
        ...challenge,
        solvedAt: new Date(challenge.solvedAt),
      }))
      .sort((a, b) => b.solvedAt.getTime() - a.solvedAt.getTime()), // Sort by most recent first
  };
}

export interface UseTeamStatusOptions {
  /**
   * Callback function that is called when the team status is updated.
   * Receives the team name from the status response.
   */
  onTeamUpdate?: (teamName: string) => void;
}

/**
 * Custom hook for fetching and polling a team's status.
 *
 * This hook uses HTTP long polling to keep the team status up-to-date.
 * It polls faster when the instance is not ready (1 second) to provide quick
 * feedback during instance startup, and slower when ready (5 seconds).
 *
 * @param team - The name of the team to fetch, or null/"me" for current logged-in team. If undefined, polling is disabled.
 * @param options - Configuration options including callback for team updates
 * @returns An object containing:
 *   - data: The team status data, or null if not yet loaded
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useTeamStatus(
  team: string | "me",
  options?: UseTeamStatusOptions
) {
  const { onTeamUpdate } = options || {};

  const fetchFn = (lastSeen: Date | null, signal: AbortSignal) =>
    fetchTeamStatus(team, lastSeen, signal);

  const result = useHttpLongPoll<TeamStatus>({
    fetchFn,
    enabled: team !== undefined,
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
