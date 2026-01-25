import { useState } from "react";
import toast from "react-hot-toast";
import { FormattedMessage } from "react-intl";

import { Card } from "./Card";

const buttonClasses =
  "inline m-0 bg-gray-700 text-white p-2 px-3 text-sm rounded-sm disabled:cursor-wait disabled:opacity-50";

export default function AdminNotificationForm() {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function sendNotification() {
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch("/balancer/api/admin-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send notification");
      }

      toast.success("message sent");
      setText("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <h1 className="text-xl font-semibold">
        <FormattedMessage
          id="admin_page.send_message_button"
          defaultMessage="Send a notification"
        />
      </h1>
      <div>
        <textarea
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="message text..."
          className="bg-gray-300 mb-2 border-none rounded-sm p-3 text-sm block w-full text-gray-800 invalid:outline invalid:outline-red-500 invalid:bg-red-100"
        />
        <button
          className={buttonClasses}
          disabled={sending}
          onClick={sendNotification}
        >
          {sending ? (
            <FormattedMessage
              id="admin_table.sending"
              defaultMessage="sending..."
            />
          ) : (
            <FormattedMessage
              id="admin_page.send_notification"
              defaultMessage="send"
            />
          )}
        </button>
      </div>
    </Card>
  );
}
