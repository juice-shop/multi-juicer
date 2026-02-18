import type { ActivityEvent } from "@/hooks/useActivityFeed";
import { useNotifications } from "@/hooks/useNotifications";
import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

import { CtfNotificationBanner } from "./CtfNotificationBanner";
import { InfoPanel } from "./InfoPanel";
import { LiveActivityPanel } from "./LiveActivityPanel";
import { TeamsPanel } from "./TeamsPanel";

interface LeftPanelsProps {
  teamsOpen: boolean;
  activityOpen: boolean;
  onTeamsToggle: () => void;
  onActivityToggle: () => void;
  challengeMappings: ChallengeCountryMapping[];
  activities: ActivityEvent[] | null;
  activitiesLoading: boolean;
  activitiesError: string | null;
}

export function LeftPanels({
  teamsOpen,
  activityOpen,
  onTeamsToggle,
  onActivityToggle,
  challengeMappings,
  activities,
  activitiesLoading,
  activitiesError,
}: LeftPanelsProps) {
  const { data: notification } = useNotifications();
  const hasNotification =
    notification && notification.enabled && notification.message;

  // Determine grid template rows based on which panels are open
  // When notification is present, add an extra "auto" row after the first
  const notifRow = hasNotification ? " auto" : "";

  let gridTemplateRows = `auto${notifRow} auto auto`; // all-collapsed
  let alignContent = "start";

  if (teamsOpen && activityOpen) {
    gridTemplateRows = `auto${notifRow} 1fr 1fr`; // both-open
    alignContent = "stretch";
  } else if (teamsOpen) {
    gridTemplateRows = `auto${notifRow} 1fr auto`; // teams-open
    alignContent = "stretch";
  } else if (activityOpen) {
    gridTemplateRows = `auto${notifRow} auto 1fr`; // activity-open
    alignContent = "stretch";
  }

  return (
    <div
      className="absolute top-5 left-5 bottom-5 w-87.5 grid gap-2.5 z-100 max-[1024px]:w-70 max-[768px]:hidden"
      style={{ gridTemplateRows, alignContent }}
    >
      <InfoPanel />
      {hasNotification && <CtfNotificationBanner notification={notification} />}
      <TeamsPanel isOpen={teamsOpen} onToggle={onTeamsToggle} />
      <LiveActivityPanel
        isOpen={activityOpen}
        onToggle={onActivityToggle}
        challengeMappings={challengeMappings}
        activities={activities}
        activitiesLoading={activitiesLoading}
        activitiesError={activitiesError}
      />
    </div>
  );
}
