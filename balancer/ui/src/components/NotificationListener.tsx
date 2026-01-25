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
        <strong>{data.text}</strong>
      </div>
    );

    toast(content, { duration: 0 });
  }, [data]);

  return null;
}
