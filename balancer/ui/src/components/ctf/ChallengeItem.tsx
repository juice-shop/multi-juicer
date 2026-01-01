import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

interface ChallengeItemProps {
  mapping: ChallengeCountryMapping;
  isHighlighted: boolean;
  onClick?: (mapping: ChallengeCountryMapping) => void;
}

export function ChallengeItem({
  mapping,
  isHighlighted,
  onClick,
}: ChallengeItemProps) {
  const { challenge, countryName } = mapping;

  // Generate difficulty stars
  const stars = "★".repeat(challenge.difficulty);

  // Format solve count
  const solveText =
    challenge.solveCount === 0
      ? "Unsolved"
      : `${challenge.solveCount} ${challenge.solveCount === 1 ? "Solve" : "Solves"}`;

  const isSolved = challenge.solveCount > 0;

  return (
    <div
      className={`challenge-item ${isHighlighted ? "highlighted" : ""}`}
      data-country={countryName || "unassigned"}
      data-challenge-key={challenge.key}
      onClick={() => onClick?.(mapping)}
    >
      <div className="challenge-row-1">
        {challenge.name} - {countryName || "Unassigned"}
      </div>
      <div className={`challenge-row-2 ${isSolved ? "solved" : ""}`}>
        <span className="difficulty">{stars}</span> - {solveText}
      </div>
    </div>
  );
}
