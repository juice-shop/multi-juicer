import { FormattedMessage } from "react-intl";

import { useCountdown } from "@/hooks/useCountdown";
import type { NotificationData } from "@/hooks/useNotifications";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function CtfGameClock({
  notification,
}: {
  notification: NotificationData;
}) {
  const countdown = useCountdown(notification.endDate, notification.updatedAt);

  if (!countdown) return null;

  return (
    <div className="p-5 bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)] flex flex-col gap-2">
      <div className="text-[10px] text-center font-bold tracking-[0.2em] uppercase text-ctf-primary">
        <FormattedMessage
          id="ctf.game_clock.title"
          defaultMessage="Game Clock"
        />
      </div>

      {countdown.isExpired ? (
        <div className="text-ctf-primary text-sm font-medium text-center py-1">
          <FormattedMessage
            id="ctf.game_clock.ended"
            defaultMessage="The event has ended"
          />
        </div>
      ) : (
        <>
          <div
            className="text-center font-mono tabular-nums text-2xl font-bold text-ctf-primary"
            style={{
              textShadow:
                "0 0 10px rgba(255,107,107,0.6), 0 0 20px rgba(255,107,107,0.3)",
            }}
          >
            {pad2(countdown.hours)}:{pad2(countdown.minutes)}:
            {pad2(countdown.seconds)}
            <span className="text-base opacity-60">
              .{pad2(countdown.milliseconds)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
