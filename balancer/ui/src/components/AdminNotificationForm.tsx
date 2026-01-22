import { useState } from "react";
import toast from "react-hot-toast";

export default function AdminNotificationForm() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warning" | "error">("info");
  const [sending, setSending] = useState(false);

  async function sendNotification() {
    if (!title || sending) return;

    setSending(true);
    try {
      const res = await fetch("/balancer/api/admin-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          message,
          level,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send notification");
      }

      toast.success("message sent");
      setTitle("");
      setMessage("");
      setLevel("info");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 border rounded p-4 bg-gray-50 dark:bg-gray-900">
      <h2 className="font-semibold text-lg">Send a message to teams...</h2>

      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="message heading..."
        className="border px-2 py-1 rounded w-full"
      />

      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="message text..."
        className="border px-2 py-1 rounded w-full"
      />

      <div className="flex gap-4 text-sm">
        {(["info", "warning", "error"] as const).map((lvl) => (
          <label key={lvl} className="flex items-center gap-1">
            <input
              type="radio"
              name="level"
              value={lvl}
              checked={level === lvl}
              onChange={() => setLevel(lvl)}
            />
            {lvl}
          </label>
        ))}
      </div>

      <button
        onClick={sendNotification}
        disabled={sending}
        className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
