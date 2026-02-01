import DOMPurify from "dompurify";
import { useMemo } from "react";
import snarkdown from "snarkdown";

import type { NotificationData } from "../hooks/useNotifications";

export function NotificationBanner({
  notification,
}: {
  notification: NotificationData | null;
}) {
  const sanitizedHtml = useMemo(() => {
    const rawHtml = snarkdown(notification?.message || "");
    return DOMPurify.sanitize(rawHtml);
  }, [notification?.message]);

  if (!notification || !notification.enabled || !notification.message) {
    return null;
  }

  return (
    <div className="w-full border-b-blue-600 border-b-2 dark:bg-blue-900/20 border-0 dark:border-gray-700 rounded-t-lg px-4 py-4 flex items-center gap-3">
      <span
        className="text-blue-900 dark:text-blue-100 text-sm font-medium [&_a]:underline [&_a]:font-semibold hover:[&_a]:text-blue-700 dark:hover:[&_a]:text-blue-300 [&_strong]:font-bold [&_em]:italic [&_code]:bg-blue-100 [&_code]:dark:bg-blue-800 [&_code]:px-1 [&_code]:rounded"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
}
