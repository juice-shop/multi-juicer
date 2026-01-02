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
      className={`p-2.5 bg-ctf-bg-item border border-ctf-border transition-all duration-300 cursor-pointer hover:border-ctf-border-hover hover:bg-ctf-bg-item-hover ${
        isHighlighted
          ? "border-ctf-accent bg-ctf-magenta shadow-[0_0_8px_rgba(255,0,255,0.3),inset_0_0_5px_rgba(255,0,255,0.15)] animate-[pulse-highlight_1.5s_ease-in-out_infinite]"
          : ""
      }`}
      data-country={countryName || "unassigned"}
      data-challenge-key={challenge.key}
      onClick={() => onClick?.(mapping)}
    >
      <div className="text-xs font-bold uppercase tracking-[1px] text-ctf-primary mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
        {challenge.name} - {countryName || "Unassigned"}
      </div>
      <div
        className={`text-[10px] opacity-90 uppercase tracking-[1px] ${isSolved ? "text-ctf-secondary" : "text-ctf-neutral"}`}
      >
        <span className="text-ctf-accent">{stars}</span> - {solveText}
      </div>
    </div>
  );
}
