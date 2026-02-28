import DOMPurify from "dompurify";
import { useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import snarkdown from "snarkdown";

import type { NotificationData } from "@/hooks/useNotifications";

interface InfoPanelProps {
  notification?: NotificationData | null;
}

export function InfoPanel({ notification }: InfoPanelProps) {
  const intl = useIntl();

  const hasNotification =
    notification && notification.enabled && notification.message;

  const sanitizedHtml = useMemo(() => {
    if (!hasNotification) return "";
    const rawHtml = snarkdown(notification.message);
    return DOMPurify.sanitize(rawHtml);
  }, [hasNotification, notification?.message]);

  return (
    <div className="p-5 bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] uppercase tracking-[2px] flex flex-col items-center justify-center gap-3 shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)]">
      <h1
        className="text-2xl font-bold m-0 text-center flex items-center gap-2.5 text-ctf-primary"
        style={{
          textShadow:
            "0 0 10px var(--color-ctf-primary), 0 0 20px var(--color-ctf-primary)",
        }}
      >
        <img
          src="/balancer/favicon.svg"
          alt={intl.formatMessage({
            id: "ctf.info_panel.logo_alt",
            defaultMessage: "MultiJuicer Logo",
          })}
          className="h-[1.4em] w-auto align-middle"
        />
        <FormattedMessage
          id="ctf.info_panel.title"
          defaultMessage="MultiJuicer CTF"
        />
      </h1>
      {hasNotification && (
        <div className="w-full border-t border-ctf-primary/30 pt-3 normal-case tracking-normal text-ctf-primary text-sm text-center font-medium">
          <span
            className="[&_a]:underline [&_a]:font-semibold [&_strong]:font-bold [&_em]:italic [&_code]:bg-ctf-primary/20 [&_code]:px-1 [&_code]:rounded"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </div>
      )}
    </div>
  );
}
