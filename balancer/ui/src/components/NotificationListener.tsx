import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { useAdminMessage } from "@/hooks/useAdminMessage";

export function NotificationListener() {
  const { data } = useAdminMessage();
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;

    if (lastSeenRef.current === data.updatedAt) return;
    lastSeenRef.current = data.updatedAt;

    const content = (
      <div>
        <strong>{data.title}</strong>
        <div>{data.message}</div>
      </div>
    );

    switch (data.level) {
      case "error":
        toast.error(content, { icon: "❌", duration: 0 });
        break;
      case "warning":
        toast(content, { icon: "⚠️", duration: 0 });
        break;
      case "info":
      default:
        toast(content, { icon: "🔔", duration: 0 });
        break;
    }
  }, [data]);

  return null;
}
