import {
  useHttpLongPoll,
  FetchResult,
  extractLastUpdateTimestamp,
} from "./useHttpLongPoll";

export interface NotificationData {
  message: string;
  enabled: boolean;
  updatedAt: string; // ISO String
}

/**
 * Fetches the notification data from the backend.
 *
 * @param lastSeen - The timestamp of the last update, or null for initial fetch
 * @param signal - AbortSignal for request cancellation
 * @returns The notification data (including enabled field) and server timestamp, or null on long-poll timeout
 */
async function fetchNotification(
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<FetchResult<NotificationData>> {
  const url = lastSeen
    ? `/balancer/api/notifications?wait-for-update-after=${lastSeen.toISOString()}`
    : "/balancer/api/notifications";

  const response = await fetch(url, { signal });

  const lastUpdateTimestamp = extractLastUpdateTimestamp(response);

  // Status 204 No Content means long-poll timeout (no updates within the wait period)
  if (response.status === 204) {
    return { data: null, lastUpdateTimestamp };
  }
  if (!response.ok) {
    throw new Error("Failed to fetch notification");
  }

  const data: NotificationData = await response.json();

  // Always return the full data including the enabled field
  // Let components decide how to handle disabled/empty notifications
  return { data, lastUpdateTimestamp };
}

/**
 * Custom hook for fetching and polling notification data.
 *
 * This hook uses HTTP long polling to keep notifications up-to-date.
 * It automatically handles retries on errors and ensures a minimum of 3 seconds
 * between requests to avoid spamming the server.
 *
 * @returns An object containing:
 *   - data: The notification data (including enabled field), or null on timeout
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useNotifications() {
  return useHttpLongPoll<NotificationData>({
    fetchFn: fetchNotification,
  });
}
