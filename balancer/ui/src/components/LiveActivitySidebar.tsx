import { useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";

import { classNames } from "@/util/classNames";

import { Card } from "./Card";
import { ReadableTimestamp } from "./ReadableTimestamp";
import { Spinner } from "./Spinner";

// --- Type Definitions ---
interface ActivityEvent {
  team: string;
  challengeKey: string; // Added challengeKey to use in links
  challengeName: string;
  points: number;
  solvedAt: string; // ISO String
  isFirstSolve: boolean;
}

// --- API Fetching ---
async function fetchActivityFeed(
  signal?: AbortSignal
): Promise<ActivityEvent[]> {
  const response = await fetch("/balancer/api/activity-feed", { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch activity feed");
  }
  return response.json();
}

// --- Event Item Component ---
const EventItem = ({
  event,
  isLast,
}: {
  event: ActivityEvent;
  isLast: boolean;
}) => {
  const eventColor = event.isFirstSolve
    ? "border-red-500"
    : "border-orange-500";

  return (
    <div className="relative pl-6">
      {/* Timeline Marker */}
      <div
        className={classNames(
          "absolute left-0 top-1.5 w-3 h-3 rounded-full bg-white dark:bg-gray-800 border-2",
          eventColor
        )}
      ></div>
      {/* Timeline Vertical Line */}
      {!isLast && (
        <div className="absolute left-[6px] top-[18px] h-full w-px bg-orange-500"></div>
      )}

      <p className="text-sm">
        <Link
          to={`/score-overview/teams/${event.team}`}
          className="font-bold hover:underline"
        >
          {event.team}
        </Link>{" "}
        <FormattedMessage id="activity.solved" defaultMessage="solved" />{" "}
        <Link
          to={`/score-overview/challenges/${event.challengeKey}`}
          className="font-bold hover:underline"
        >
          {event.challengeName}
        </Link>{" "}
        <FormattedMessage
          id="activity.points_earned"
          defaultMessage="(+{points} pts)"
          values={{
            points: event.points,
            b: (chunks) => (
              <span className="text-green-500 font-semibold">{chunks}</span>
            ),
          }}
        />
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <ReadableTimestamp date={new Date(event.solvedAt)} />
      </p>
    </div>
  );
};

// --- Main Sidebar Component ---
export const LiveActivitySidebar = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const loadAndPollRef = useRef<
    ((signal: AbortSignal) => Promise<void>) | null
  >(null);

  loadAndPollRef.current = async (signal: AbortSignal) => {
    try {
      const data = await fetchActivityFeed(signal);
      setEvents(data);
    } catch (error) {
      // Ignore abort errors - these are expected when component unmounts
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();

    // Initial load
    loadAndPollRef.current?.(abortController.signal);

    // Poll every 5 seconds
    intervalRef.current = window.setInterval(() => {
      loadAndPollRef.current?.(abortController.signal);
    }, 5000);

    return () => {
      abortController.abort();
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <Card className="border-t-4 border-orange-500">
      <div className="p-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
          </span>
          <FormattedMessage
            id="activity.title"
            defaultMessage="Live Activity"
          />
        </h2>
      </div>
      <div className="h-[500px] overflow-y-auto p-4 pt-0">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner />
          </div>
        ) : events.length === 0 ? (
          <p className="text-gray-500">
            <FormattedMessage
              id="activity.no_events"
              defaultMessage="No recent activity."
            />
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((event, index) => (
              <EventItem
                key={`${event.challengeKey}-${event.team}`}
                event={event}
                isLast={index === events.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
