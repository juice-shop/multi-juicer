import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

import { ChallengeDetailView } from "./ChallengeDetailView";
import { ChallengesList } from "./ChallengesList";

interface ChallengesPanelProps {
  mappings: ChallengeCountryMapping[];
  hoveredCountry: string | null;
  selectedChallenge: ChallengeCountryMapping | null;
  onChallengeClick: (mapping: ChallengeCountryMapping) => void;
  onBackFromDetail: () => void;
}

export function ChallengesPanel({
  mappings,
  hoveredCountry,
  selectedChallenge,
  onChallengeClick,
  onBackFromDetail,
}: ChallengesPanelProps) {
  // When a challenge is selected, show detail view (no collapse state)
  if (selectedChallenge) {
    return (
      <div className="challenges-panel open">
        <div className="challenges-content">
          <ChallengeDetailView
            mapping={selectedChallenge}
            onBack={onBackFromDetail}
          />
        </div>
      </div>
    );
  }

  // Otherwise show the normal challenges list (without collapse functionality for now)
  return (
    <div className="challenges-panel open">
      <div className="challenges-summary">CHALLENGES ({mappings.length})</div>
      <div className="challenges-content">
        <ChallengesList
          mappings={mappings}
          hoveredCountry={hoveredCountry}
          onChallengeClick={onChallengeClick}
        />
      </div>
    </div>
  );
}
