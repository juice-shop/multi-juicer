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
    <div className="challenges-list" ref={listRef}>
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
