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

    // toast.dismiss();
    toast(
      (t) => (
        <span className="flex gap-2 items-start justify-center">
          <strong className="break-all">Message from admin: {data.text}</strong>
          <button
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-600 text-white text-sm leading-none hover:bg-red-700 transition"
            onClick={() => toast.dismiss(t.id)}
          >
            ✕
          </button>
        </span>
      ),
      { duration: Infinity }
    );
  }, [data]);

  return null;
}
