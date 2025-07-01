import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FormattedMessage } from "react-intl";
import { Card } from "./Card";
import { ReadableTimestamp } from "./ReadableTimestamp";
import { Spinner } from "./Spinner";
import { classNames } from "../util/classNames";

// Type Definitions 
interface ActivityEvent {
  team: string;
  challengeName: string;
  points: number;
  solvedAt: string; // ISO String
  isFirstBlood: boolean;
}

// API Fetching 
async function fetchActivityFeed(): Promise<ActivityEvent[]> {
  const response = await fetch("/balancer/api/v2/activity-feed");
  if (!response.ok) {
    throw new Error("Failed to fetch activity feed");
  }
  return response.json();
}

// Event Item Component 
const EventItem = ({ event, isLast }: { event: ActivityEvent; isLast: boolean }) => {
  const eventColor = event.isFirstBlood ? "border-red-500" : "border-orange-500";
  const textColor = event.isFirstBlood ? "text-red-500" : "";

  return (
    <div className="relative pl-6">
      {/* Timeline Marker */}
      <div className={classNames("absolute left-0 top-1.5 w-3 h-3 rounded-full bg-white dark:bg-gray-800 border-2", eventColor)}></div>
      {/* Timeline Vertical Line */}
      {!isLast && <div className="absolute left-[5px] top-[18px] h-full w-px bg-orange-500"></div>}

      <p className={classNames("text-sm", textColor)}>
        <Link to={`/v2/teams/${event.team}`} className="font-bold hover:underline">{event.team}</Link>
        {' '}
        <FormattedMessage id="activity.solved" defaultMessage="solved" />
        {' '}
        <span className="font-bold">{event.challengeName}</span>
        {' '}
        <span className="text-green-500 font-semibold">(+{event.points} pts)</span>
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <ReadableTimestamp date={new Date(event.solvedAt)} />
      </p>
    </div>
  );
};

// Main Sidebar Component 
export const LiveActivitySidebar = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAndPoll = async () => {
      try {
        const data = await fetchActivityFeed();
        setEvents(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAndPoll(); // Initial load
    const interval = setInterval(loadAndPoll, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-t-4 border-orange-500">
      <div className="p-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
          </span>
          <FormattedMessage id="activity.title" defaultMessage="Live Activity" />
        </h2>
      </div>
      <div className="h-[500px] overflow-y-auto p-4 pt-0">
        {isLoading ? (
          <div className="flex justify-center items-center h-full"><Spinner /></div>
        ) : events.length === 0 ? (
          <p className="text-gray-500"><FormattedMessage id="activity.no_events" defaultMessage="No recent activity." /></p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((event, index) => (
              <EventItem key={`${event.solvedAt}-${event.team}`} event={event} isLast={index === events.length - 1} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};