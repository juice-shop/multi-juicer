import {
  extractLastUpdateTimestamp,
  type FetchResult,
  useHttpLongPoll,
} from "./useHttpLongPoll";

export interface ClassProgressTeam {
  name: string;
  solvedChallenges: string[];
}

async function fetchClassProgress(
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<FetchResult<ClassProgressTeam[]>> {
  const url = lastSeen
    ? `/multi-juicer/api/class-progress?wait-for-update-after=${lastSeen.toISOString()}`
    : "/multi-juicer/api/class-progress";

  const response = await fetch(url, { signal });

  const lastUpdateTimestamp = extractLastUpdateTimestamp(response);

  // Status 204 No Content means the long-poll timed out without new data
  if (response.status === 204) {
    return { data: null, lastUpdateTimestamp };
  }
  if (!response.ok) {
    throw new Error("Failed to fetch class progress");
  }

  const { teams } = (await response.json()) as { teams: ClassProgressTeam[] };
  return { data: teams, lastUpdateTimestamp };
}

export function useClassProgress() {
  return useHttpLongPoll<ClassProgressTeam[]>({
    fetchFn: fetchClassProgress,
  });
}
