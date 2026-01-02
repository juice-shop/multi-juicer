import { useEffect, useRef } from "react";

import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

import { ChallengeItem } from "./ChallengeItem";

interface ChallengesListProps {
  mappings: ChallengeCountryMapping[];
  hoveredCountry: string | null;
  onChallengeClick?: (mapping: ChallengeCountryMapping) => void;
}

export function ChallengesList({
  mappings,
  hoveredCountry,
  onChallengeClick,
}: ChallengesListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted challenge when country is hovered
  useEffect(() => {
    if (hoveredCountry && listRef.current) {
      const element = listRef.current.querySelector(
        `[data-country="${hoveredCountry}"]`
      ) as HTMLElement;

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [hoveredCountry]);

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 flex flex-col gap-2.5 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[rgba(0,255,255,0.1)] [&::-webkit-scrollbar-thumb]:bg-ctf-primary [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:shadow-[0_0_3px_rgba(255,107,107,0.4)] [&::-webkit-scrollbar-thumb:hover]:bg-ctf-accent [&::-webkit-scrollbar-thumb:hover]:shadow-[0_0_5px_rgba(255,0,255,0.5)]"
      ref={listRef}
    >
      {mappings.map((mapping) => (
        <ChallengeItem
          key={mapping.challenge.key}
          mapping={mapping}
          isHighlighted={mapping.countryName === hoveredCountry}
          onClick={onChallengeClick}
        />
      ))}
    </div>
  );
}
