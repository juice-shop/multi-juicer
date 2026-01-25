import { useHttpLongPoll } from "./useHttpLongPoll";

export interface AdminMessage {
  text: string;
  updatedAt: string;
}

async function fetchAdminMessage(
  lastSeen: Date | null,
  signal: AbortSignal
): Promise<AdminMessage | null> {
  const url = lastSeen
    ? `/balancer/api/admin-message?wait-for-update-after=${lastSeen.toISOString()}`
    : `/balancer/api/admin-message`;

  const res = await fetch(url, { signal });

  if (res.status === 204) return null;
  if (!res.ok) throw new Error("failed");

  return res.json();
}

export function useAdminMessage() {
  return useHttpLongPoll<AdminMessage>({
    fetchFn: fetchAdminMessage,
  });
}
