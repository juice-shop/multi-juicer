import { useEffect, useState } from "react";

import {
  extractLastUpdateTimestamp,
  type FetchResult,
  useHttpLongPoll,
} from "./useHttpLongPoll";

const classProgressUrl = "/multi-juicer/api/class-progress";

export interface ClassProgressChallenge {
  key: string;
  name: string;
  solveCount: number;
}

export interface ClassProgressTeam {
  name: string;
  mandatorySolved: number;
  suggestedSolved: number;
  solvedChallenges: string[];
}

export interface ClassProgress {
  mandatory: ClassProgressChallenge[];
  suggested: ClassProgressChallenge[];
  teams: ClassProgressTeam[];
}

async function fetchClassProgress(
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<FetchResult<ClassProgress>> {
  const url = lastSeen
    ? `${classProgressUrl}?wait-for-update-after=${lastSeen.toISOString()}`
    : classProgressUrl;

  const response = await fetch(url, { signal });

  const lastUpdateTimestamp = extractLastUpdateTimestamp(response);

  // Status 204 No Content means the long-poll timed out without new data
  if (response.status === 204) {
    return { data: null, lastUpdateTimestamp };
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Class progress not configured");
    }
    throw new Error("Failed to fetch class progress");
  }

  const classProgress = (await response.json()) as ClassProgress;
  return { data: classProgress, lastUpdateTimestamp };
}

/**
 * Fetches and long-polls the progress of all teams on the mandatory and suggested challenges of the class.
 */
export function useClassProgress() {
  return useHttpLongPoll<ClassProgress>({
    fetchFn: fetchClassProgress,
  });
}

/**
 * Checks once whether class progress is configured, the endpoint returns 404 otherwise.
 */
export function useIsClassProgressEnabled() {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(classProgressUrl, { method: "HEAD", signal: controller.signal })
      .then((response) => setIsEnabled(response.ok))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return isEnabled;
}
