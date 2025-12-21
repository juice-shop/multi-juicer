import { useState } from "react";

type Team = {
  team: string;
};

export default function AdminNotificationForm({ teams }: { teams: Team[] }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [team, setTeam] = useState<string>("");

  async function sendNotification() {
    if (!title) return;

    const res = await fetch("/balancer/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team,
        title,
        message,
        level: "info",
      }),
    });

    if (!res.ok) {
      console.error("Failed to send notification");
      return;
    }

    setTitle("");
    setMessage("");
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Notification title"
        className="border px-2 py-1 rounded"
      />
      <input
        type="text"
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Notification message"
        className="border px-2 py-1 rounded"
      />

      <div className="flex gap-2">
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="">All teams</option>
          {teams.map((item, index) => (
            <option key={index} value={item.team}>
              {item.team}
            </option>
          ))}
        </select>

        <button
          onClick={sendNotification}
          className="px-2 py-1 rounded-lg bg-blue-600 text-white"
        >
          Send
        </button>
      </div>
    </div>
  );
}
