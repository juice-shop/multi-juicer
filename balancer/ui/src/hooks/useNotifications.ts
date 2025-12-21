import { useHttpLongPoll } from "./useHttpLongPoll"

export interface Notification {
  team: string
  title: string
  message: string
  level: "info" | "warning" | "critical"
  createdAt: string
}


async function fetchNotifications(
  lastSeen: Date | null,
  signal: AbortSignal
): Promise<Notification[] | null> {

  const url = lastSeen
    ? `/balancer/api/notifications?wait-for-update-after=${lastSeen.toISOString()}`
    : `/balancer/api/notifications`

  const res = await fetch(url, { signal })

  if (res.status === 204) return null
  if (!res.ok) throw new Error("Failed to fetch notifications")

  return res.json()
}

export function useNotifications() {
  return useHttpLongPoll<Notification[]>({
    fetchFn: fetchNotifications,
  })
}
