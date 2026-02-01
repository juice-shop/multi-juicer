import type { NotificationData } from "../hooks/useNotifications";

export function NotificationBanner({
  notification,
}: {
  notification: NotificationData | null;
}) {
  // Don't render if no notification or empty message
  if (!notification || !notification.message) {
    return null;
  }

  return (
    <div className="w-full border-b-blue-600 border-b-2 dark:bg-blue-900/20 border-0 dark:border-gray-700 rounded-t-lg px-4 py-4 flex items-center gap-3">
      <span className={`text-blue-900 dark:text-blue-100 text-sm font-medium`}>
        {notification.message}
      </span>
    </div>
  );
}
