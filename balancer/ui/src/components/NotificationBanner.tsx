import DOMPurify from "dompurify";
import { useMemo } from "react";
import { FormattedMessage } from "react-intl";
import snarkdown from "snarkdown";

import { useCountdown } from "../hooks/useCountdown";
import type { NotificationData } from "../hooks/useNotifications";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function NotificationBanner({
  notification,
}: {
  notification: NotificationData | null;
}) {
  const countdown = useCountdown(notification?.endDate);
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
        className="text-blue-900 dark:text-blue-100 text-sm font-medium [&_a]:underline [&_a]:font-semibold hover:[&_a]:text-blue-700 dark:hover:[&_a]:text-blue-300 [&_strong]:font-bold [&_em]:italic [&_code]:bg-blue-100 [&_code]:dark:bg-blue-800 [&_code]:px-1 [&_code]:rounded flex-1"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      {countdown && (
        <span className="text-blue-900 dark:text-blue-100 text-sm font-mono tabular-nums whitespace-nowrap ml-auto">
          {countdown.isExpired ? (
            <FormattedMessage
              id="notification.event_ended"
              defaultMessage="The event has ended"
            />
          ) : (
            `${pad2(countdown.hours)}:${pad2(countdown.minutes)}:${pad2(countdown.seconds)}`
          )}
        </span>
      )}
    </div>
  );
}
