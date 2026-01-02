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
  // Determine grid template rows based on which panels are open
  let gridTemplateRows = "auto auto auto"; // all-collapsed
  let alignContent = "start";

  if (teamsOpen && activityOpen) {
    gridTemplateRows = "auto 1fr 1fr"; // both-open
    alignContent = "stretch";
  } else if (teamsOpen) {
    gridTemplateRows = "auto 1fr auto"; // teams-open
    alignContent = "stretch";
  } else if (activityOpen) {
    gridTemplateRows = "auto auto 1fr"; // activity-open
    alignContent = "stretch";
  }

  return (
    <div
      className="absolute top-5 left-5 bottom-5 w-[350px] grid gap-2.5 z-100 max-[1024px]:w-[280px] max-[768px]:hidden"
      style={{ gridTemplateRows, alignContent }}
    >
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
