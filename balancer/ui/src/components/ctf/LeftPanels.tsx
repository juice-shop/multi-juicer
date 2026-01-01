import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

import { InfoPanel } from "./InfoPanel";
import { LiveActivityPanel } from "./LiveActivityPanel";
import { TeamsPanel } from "./TeamsPanel";

interface LeftPanelsProps {
  teamsOpen: boolean;
  activityOpen: boolean;
  onTeamsToggle: () => void;
  onActivityToggle: () => void;
  challengeMappings: ChallengeCountryMapping[];
}

export function LeftPanels({
  teamsOpen,
  activityOpen,
  onTeamsToggle,
  onActivityToggle,
  challengeMappings,
}: LeftPanelsProps) {
  let containerClass = "left-panels-container";

  if (teamsOpen && activityOpen) {
    containerClass += " both-open";
  } else if (teamsOpen) {
    containerClass += " teams-open";
  } else if (activityOpen) {
    containerClass += " activity-open";
  } else {
    containerClass += " all-collapsed";
  }

  return (
    <div className={containerClass}>
      <InfoPanel />
      <TeamsPanel isOpen={teamsOpen} onToggle={onTeamsToggle} />
      <LiveActivityPanel
        isOpen={activityOpen}
        onToggle={onActivityToggle}
        challengeMappings={challengeMappings}
      />
    </div>
  );
}
