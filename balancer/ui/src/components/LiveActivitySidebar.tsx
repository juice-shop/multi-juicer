import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";

import {
  useActivityFeed,
  type ActivityEvent,
  isTeamCreatedEvent,
  isChallengeSolvedEvent,
} from "@/hooks/useActivityFeed";
import { classNames } from "@/util/classNames";

import { Card } from "./Card";
import { ReadableTimestamp } from "./ReadableTimestamp";
import { Spinner } from "./Spinner";

const EventItem = ({
  event,
  isLast,
}: {
  event: ActivityEvent;
  isLast: boolean;
}) => {
  const eventColor = isTeamCreatedEvent(event)
    ? "border-yellow-400"
    : event.isFirstSolve
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
        <div className="absolute left-1.5 top-4.5 h-full w-px bg-orange-500"></div>
      )}

      <p className="text-sm">
        {isTeamCreatedEvent(event) ? (
          <FormattedMessage
            id="activity.team_joined"
            defaultMessage="{team} joined"
            values={{
              team: (
                <Link
                  to={`/score-overview/teams/${event.team}`}
                  className="font-bold hover:underline"
                >
                  {event.team}
                </Link>
              ),
            }}
          />
        ) : isChallengeSolvedEvent(event) ? (
          <FormattedMessage
            id="activity.solved_challenge"
            defaultMessage="{team} solved {challenge} (+{points} pts)"
            values={{
              team: (
                <Link
                  to={`/score-overview/teams/${event.team}`}
                  className="font-bold hover:underline"
                >
                  {event.team}
                </Link>
              ),
              challenge: (
                <Link
                  to={`/score-overview/challenges/${event.challengeKey}`}
                  className="font-bold hover:underline"
                >
                  {event.challengeName}
                </Link>
              ),
              points: (
                <span className="text-green-500 font-semibold">
                  {event.points}
                </span>
              ),
            }}
          />
        ) : null}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <ReadableTimestamp date={new Date(event.timestamp)} />
      </p>
    </div>
  );
};

export const LiveActivitySidebar = () => {
  const { data: events, isLoading } = useActivityFeed();

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
      <div className="h-125 overflow-y-auto p-4 pt-0">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner />
          </div>
        ) : !events || events.length === 0 ? (
          <p className="text-gray-500">
            <FormattedMessage
              id="activity.no_events"
              defaultMessage="No recent activity."
            />
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((event, index) => {
              const key = isChallengeSolvedEvent(event)
                ? `${event.eventType}-${event.challengeKey}-${index}`
                : `${event.eventType}-${event.team}-${index}`;

              return (
                <EventItem
                  key={key}
                  event={event}
                  isLast={index === events.length - 1}
                />
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
