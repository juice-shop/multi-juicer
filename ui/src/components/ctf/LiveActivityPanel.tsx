import { useEffect, useState } from "react";
import { FormattedMessage, useIntl, type IntlShape } from "react-intl";

import {
  isTeamCreatedEvent,
  isChallengeSolvedEvent,
  type ActivityEvent,
} from "@/hooks/useActivityFeed";
import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

function activityKey(event: ActivityEvent): string {
  if (isChallengeSolvedEvent(event)) {
    return `${event.eventType}:${event.team}:${event.challengeKey}:${event.timestamp}`;
  }
  return `${event.eventType}:${event.team}:${event.timestamp}`;
}

interface LiveActivityPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  challengeMappings: ChallengeCountryMapping[];
  activities: ActivityEvent[] | null;
  activitiesLoading: boolean;
  activitiesError: string | null;
}

function formatTimeAgo(isoString: string, intl: IntlShape): string {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60)
    return intl.formatMessage(
      {
        id: "ctf.time_ago.seconds",
        defaultMessage:
          "{count, plural, one {# second ago} other {# seconds ago}}",
      },
      { count: seconds }
    );
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return intl.formatMessage(
      {
        id: "ctf.time_ago.minutes",
        defaultMessage:
          "{count, plural, one {# minute ago} other {# minutes ago}}",
      },
      { count: minutes }
    );
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return intl.formatMessage(
      {
        id: "ctf.time_ago.hours",
        defaultMessage: "{count, plural, one {# hour ago} other {# hours ago}}",
      },
      { count: hours }
    );
  const days = Math.floor(hours / 24);
  return intl.formatMessage(
    {
      id: "ctf.time_ago.days",
      defaultMessage: "{count, plural, one {# day ago} other {# days ago}}",
    },
    { count: days }
  );
}

export function LiveActivityPanel({
  isOpen,
  onToggle,
  challengeMappings,
  activities,
  activitiesLoading,
  activitiesError,
}: LiveActivityPanelProps) {
  const intl = useIntl();
  // Re-render every 5s so relative timestamps stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  // Create a map from challengeKey to countryName for fast lookup
  const challengeToCountry = new Map<string, string | null>();
  for (const mapping of challengeMappings) {
    challengeToCountry.set(mapping.challenge.key, mapping.countryName);
  }

  return (
    <div
      className={`bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] flex flex-col transition-all duration-300 overflow-hidden shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)] ${isOpen ? "min-h-0" : ""}`}
    >
      <div
        className="p-[15px_20px] text-base font-bold uppercase tracking-[2px] cursor-pointer select-none text-ctf-primary border-b border-ctf-border shrink-0 hover:text-ctf-accent"
        style={{
          textShadow: "0 0 3px rgba(255, 107, 107, 0.5)",
        }}
        onClick={onToggle}
      >
        <span
          className={`inline-block transition-transform duration-200 mr-1.5 ${isOpen ? "" : "-rotate-90"}`}
        >
          ▼
        </span>{" "}
        <FormattedMessage
          id="ctf.activity_panel.title"
          defaultMessage="LIVE ACTIVITY"
        />
      </div>
      {isOpen && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[rgba(0,255,255,0.1)] [&::-webkit-scrollbar-thumb]:bg-ctf-primary [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:shadow-[0_0_3px_rgba(255,107,107,0.4)] [&::-webkit-scrollbar-thumb:hover]:bg-ctf-accent [&::-webkit-scrollbar-thumb:hover]:shadow-[0_0_5px_rgba(255,0,255,0.5)]">
          {activitiesLoading && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              <FormattedMessage
                id="ctf.activity_panel.loading"
                defaultMessage="Loading activity..."
              />
            </div>
          )}
          {activitiesError && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              <FormattedMessage
                id="ctf.activity_panel.error"
                defaultMessage="Error: {error}"
                values={{ error: activitiesError }}
              />
            </div>
          )}
          {activities && (
            <div className="flex flex-col gap-1.5">
              {activities.map((activity) => {
                const key = activityKey(activity);
                const isRecent =
                  Date.now() - new Date(activity.timestamp).getTime() < 60_000;
                const radiateClass = isRecent ? "animate-radiate rounded" : "";

                if (isTeamCreatedEvent(activity)) {
                  return (
                    <div key={key} className={`py-1.5 ${radiateClass}`}>
                      <div className="text-[11px] text-ctf-primary mb-0.5 leading-[1.4]">
                        <FormattedMessage
                          id="activity.team_joined"
                          defaultMessage="{team} joined"
                          values={{ team: `"${activity.team}"` }}
                        />
                      </div>
                      <div className="text-[9px] text-ctf-neutral opacity-70">
                        {formatTimeAgo(activity.timestamp, intl)}
                      </div>
                    </div>
                  );
                }

                if (isChallengeSolvedEvent(activity)) {
                  const countryName = challengeToCountry.get(
                    activity.challengeKey
                  );

                  return (
                    <div key={key} className={`py-1.5 ${radiateClass}`}>
                      <div className="text-[11px] text-ctf-primary mb-0.5 leading-[1.4]">
                        {countryName ? (
                          <FormattedMessage
                            id="ctf.activity_panel.challenge_solved_country"
                            defaultMessage="{team} solved {challenge} ({country}) (+{points} pts)"
                            values={{
                              team: activity.team,
                              challenge: activity.challengeName,
                              country: countryName,
                              points: activity.points,
                            }}
                          />
                        ) : (
                          <FormattedMessage
                            id="ctf.activity_panel.challenge_solved"
                            defaultMessage="{team} solved {challenge} (+{points} pts)"
                            values={{
                              team: activity.team,
                              challenge: activity.challengeName,
                              points: activity.points,
                            }}
                          />
                        )}
                      </div>
                      <div className="text-[9px] text-ctf-neutral opacity-70">
                        {formatTimeAgo(activity.timestamp, intl)}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
