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
      <div className="absolute top-5 right-5 bottom-5 w-[350px] bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] flex flex-col z-[100] transition-[height] duration-300 shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)] max-[1024px]:w-[280px] max-[1024px]:right-2.5 max-[1024px]:top-2.5 max-[1024px]:bottom-2.5 max-[768px]:hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
    <div className="absolute top-5 right-5 bottom-5 w-[350px] bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] flex flex-col z-[100] transition-[height] duration-300 shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)] max-[1024px]:w-[280px] max-[1024px]:right-2.5 max-[1024px]:top-2.5 max-[1024px]:bottom-2.5 max-[768px]:hidden">
      <div
        className="p-[15px_20px] text-base font-bold uppercase tracking-[2px] cursor-pointer select-none text-ctf-primary border-b border-ctf-border flex-shrink-0"
        style={{ textShadow: "0 0 3px rgba(255, 107, 107, 0.5)" }}
      >
        CHALLENGES ({mappings.length})
      </div>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ChallengesList
          mappings={mappings}
          hoveredCountry={hoveredCountry}
          onChallengeClick={onChallengeClick}
        />
      </div>
    </div>
  );
}
