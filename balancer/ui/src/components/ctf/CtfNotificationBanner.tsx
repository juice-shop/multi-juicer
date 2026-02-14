import DOMPurify from "dompurify";
import { useMemo } from "react";
import snarkdown from "snarkdown";

import type { NotificationData } from "@/hooks/useNotifications";

export function CtfNotificationBanner({
  notification,
}: {
  notification: NotificationData;
}) {
  const sanitizedHtml = useMemo(() => {
    const rawHtml = snarkdown(notification.message);
    return DOMPurify.sanitize(rawHtml);
  }, [notification.message]);

  return (
    <div className="px-4 py-3 bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] text-ctf-primary text-sm font-medium shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)]">
      <span
        className="[&_a]:underline [&_a]:font-semibold [&_strong]:font-bold [&_em]:italic [&_code]:bg-ctf-primary/20 [&_code]:px-1 [&_code]:rounded"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
}
