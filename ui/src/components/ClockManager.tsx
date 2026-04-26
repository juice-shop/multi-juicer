import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";

import { Card } from "@/components/Card";

const buttonClasses =
  "inline m-0 bg-gray-700 text-white p-2 px-3 text-sm rounded-sm disabled:cursor-wait disabled:opacity-50 hover:bg-gray-600";

/**
 * Converts a UTC Date to a string suitable for datetime-local input (YYYY-MM-DDTHH:mm).
 */
function toDatetimeLocalString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelativeTime(date: Date): {
  key: string;
  isPast: boolean;
  time?: string;
} {
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff <= 0) {
    return { key: "admin.clock.end_date.hint_past", isPast: true };
  }
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let time: string;
  if (hours > 0 && minutes > 0) {
    time = `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    time = `${hours}h`;
  } else {
    time = `${minutes}m`;
  }
  return {
    key: "admin.clock.end_date.hint_future",
    isPast: false,
    time,
  };
}

export function ClockManager() {
  const intl = useIntl();
  const [endDateStr, setEndDateStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/balancer/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.endDate) {
          setEndDateStr(toDatetimeLocalString(new Date(data.endDate)));
        }
      })
      .catch(() => {});
  }, []);

  const endDateHint = useMemo(() => {
    if (!endDateStr) return null;
    const date = new Date(endDateStr);
    if (isNaN(date.getTime())) return null;
    return formatRelativeTime(date);
  }, [endDateStr]);

  const handleSetClock = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!endDateStr) {
      toast.error(
        intl.formatMessage({
          id: "admin.clock.error.no_date",
          defaultMessage: "Please select an end date",
        })
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/balancer/api/admin/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endDate: new Date(endDateStr).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to set clock");
      }

      toast.success(
        intl.formatMessage({
          id: "admin.clock.success",
          defaultMessage: "Countdown clock updated successfully",
        })
      );
    } catch (error) {
      console.error("Failed to set clock:", error);
      toast.error(
        intl.formatMessage({
          id: "admin.clock.error",
          defaultMessage: "Failed to update countdown clock",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearClock = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/balancer/api/admin/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endDate: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear clock");
      }

      setEndDateStr("");

      toast.success(
        intl.formatMessage({
          id: "admin.clock.cleared",
          defaultMessage: "Countdown clock cleared",
        })
      );
    } catch (error) {
      console.error("Failed to clear clock:", error);
      toast.error(
        intl.formatMessage({
          id: "admin.clock.error",
          defaultMessage: "Failed to update countdown clock",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-4 w-full">
      <details>
        <summary className="text-lg font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
          <FormattedMessage
            id="admin.clock.title"
            defaultMessage="Event Countdown Clock"
          />
        </summary>

        <p>
          <FormattedMessage
            id="admin.clock.description"
            defaultMessage="Set an event end date to display a countdown timer to all participants. The countdown is shown in the MultiJuicer UI and CTF interface."
          />
        </p>

        <form onSubmit={handleSetClock} className="flex flex-col gap-4 mt-4">
          <div>
            <label
              htmlFor="clock-end-date"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              <FormattedMessage
                id="admin.clock.end_date.label"
                defaultMessage="Event End Date"
              />
            </label>
            <input
              id="clock-end-date"
              type="datetime-local"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="bg-gray-300 border-none rounded-sm p-2 text-sm text-gray-800 w-full"
            />
            {endDateHint && (
              <p
                className={`text-sm mt-1 ${
                  endDateHint.isPast
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {endDateHint.isPast ? (
                  <FormattedMessage
                    id="admin.clock.end_date.hint_past"
                    defaultMessage="This date is in the past"
                  />
                ) : (
                  <FormattedMessage
                    id="admin.clock.end_date.hint_future"
                    defaultMessage="{time} from now"
                    values={{ time: endDateHint.time }}
                  />
                )}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={buttonClasses}
            >
              {isSubmitting ? (
                <FormattedMessage
                  id="admin.clock.submitting"
                  defaultMessage="Updating..."
                />
              ) : (
                <FormattedMessage
                  id="admin.clock.submit"
                  defaultMessage="Set Clock"
                />
              )}
            </button>

            <button
              type="button"
              onClick={handleClearClock}
              disabled={isSubmitting}
              className={buttonClasses}
            >
              <FormattedMessage
                id="admin.clock.clear"
                defaultMessage="Clear Clock"
              />
            </button>
          </div>
        </form>
      </details>
    </Card>
  );
}
