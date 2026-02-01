import { useState } from "react";
import toast from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";

import { Card } from "@/components/Card";

const buttonClasses =
  "inline m-0 bg-gray-700 text-white p-2 px-3 text-sm rounded-sm disabled:cursor-wait disabled:opacity-50 hover:bg-gray-600";

export function NotificationManager() {
  const intl = useIntl();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (message.length > 128) {
      toast.error(
        intl.formatMessage({
          id: "admin.notification.error.too_long",
          defaultMessage: "Message is too long (max 128 characters)",
        })
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/balancer/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          enabled: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to post notification");
      }

      toast.success(
        intl.formatMessage({
          id: "admin.notification.success",
          defaultMessage: "Notification updated successfully",
        })
      );
    } catch (error) {
      console.error("Failed to post notification:", error);
      toast.error(
        intl.formatMessage({
          id: "admin.notification.error",
          defaultMessage: "Failed to update notification",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/balancer/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "",
          enabled: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear notification");
      }

      setMessage("");

      toast.success(
        intl.formatMessage({
          id: "admin.notification.cleared",
          defaultMessage: "Notification cleared",
        })
      );
    } catch (error) {
      console.error("Failed to clear notification:", error);
      toast.error(
        intl.formatMessage({
          id: "admin.notification.error",
          defaultMessage: "Failed to update notification",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = 128 - message.length;

  return (
    <Card className="p-4 w-full">
      <details>
        <summary className="text-lg font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
          <FormattedMessage
            id="admin.notification.title"
            defaultMessage="Post Notifications to All Users"
          />
        </summary>

        <p>
          <FormattedMessage
            id="admin.notification.description"
            defaultMessage="Notifications are shown to all users in the MultiJuicer UI. They can be used to inform users about important updates or issues. Note: they are not displayed in the JuiceShop UI."
          />
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={intl.formatMessage({
                id: "admin.notification.placeholder",
                defaultMessage: "Enter notification message...",
              })}
              className="bg-gray-300 mb-2 border-none rounded-sm p-3 text-sm block w-full text-gray-800"
              rows={2}
              maxLength={128}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                <FormattedMessage
                  id="admin.notification.markdown_supported"
                  defaultMessage="Basic markdown supported"
                />
              </p>
              <p
                className={`text-sm ${
                  remainingChars < 50
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <FormattedMessage
                  id="admin.notification.characters_remaining"
                  defaultMessage="{count} characters remaining"
                  values={{ count: remainingChars }}
                />
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={buttonClasses}
            >
              {isSubmitting ? (
                <FormattedMessage
                  id="admin.notification.submitting"
                  defaultMessage="Updating..."
                />
              ) : (
                <FormattedMessage
                  id="admin.notification.submit"
                  defaultMessage="Post Notification"
                />
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting}
              className={buttonClasses}
            >
              <FormattedMessage
                id="admin.notification.clear"
                defaultMessage="Clear Notification"
              />
            </button>
          </div>
        </form>
      </details>
    </Card>
  );
}
