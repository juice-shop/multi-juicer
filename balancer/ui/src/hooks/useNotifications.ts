import {
  useHttpLongPoll,
  FetchResult,
  extractLastUpdateTimestamp,
} from "./useHttpLongPoll";

export interface NotificationData {
  message: string;
  updatedAt: string; // ISO String
}

/**
 * Fetches the notification data from the backend.
 *
 * @param lastSeen - The timestamp of the last update, or null for initial fetch
 * @param signal - AbortSignal for request cancellation
 * @returns The notification data and server timestamp, or null if no notification exists or server returns 204
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

  // Status 204 No Content means no notification or long-poll timeout
  if (response.status === 204) {
    return { data: null, lastUpdateTimestamp };
  }
  if (!response.ok) {
    throw new Error("Failed to fetch notification");
  }

  const data: NotificationData = await response.json();

  // Return null if message is empty
  if (!data.message || data.message.trim() === "") {
    return { data: null, lastUpdateTimestamp };
  }

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
 *   - data: The notification data, or null if no notification exists
 *   - isLoading: True during the initial load
 *   - error: Error message if the fetch failed, or null
 */
export function useNotifications() {
  return useHttpLongPoll<NotificationData>({
    fetchFn: fetchNotification,
  });
}
