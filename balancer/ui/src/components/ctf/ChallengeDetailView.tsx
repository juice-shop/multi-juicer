import { useChallengeDetail } from "@/hooks/useChallengeDetail";
import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

interface ChallengeDetailViewProps {
  mapping: ChallengeCountryMapping;
  onBack: () => void;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) {
    return "solved just now";
  } else if (diffMins < 60) {
    return `solved ${diffMins} ${diffMins === 1 ? "min" : "mins"} ago`;
  } else if (diffHours < 24) {
    return `solved ${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `solved ${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }
}

export function ChallengeDetailView({
  mapping,
  onBack,
}: ChallengeDetailViewProps) {
  const { challenge, countryName } = mapping;
  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
  } = useChallengeDetail(challenge.key);

  const stars = "★".repeat(challenge.difficulty);

  return (
    <div className="h-full flex flex-col p-5 overflow-y-auto">
      <button
        className="bg-[rgba(255,107,107,0.1)] border border-ctf-accent text-ctf-accent py-2.5 px-5 cursor-pointer font-['VT323',monospace] text-lg mb-5 transition-all duration-300 text-left w-fit hover:bg-[rgba(255,107,107,0.2)] hover:shadow-[0_0_10px_rgba(255,107,107,0.5)]"
        onClick={onBack}
      >
        ← Back
      </button>

      <div className="flex flex-col gap-5">
        <h2
          className="text-[28px] text-ctf-accent m-0 font-normal"
          style={{ textShadow: "0 0 10px rgba(255, 107, 107, 0.5)" }}
        >
          {challenge.name}
        </h2>

        <div className="text-ctf-primary text-lg">
          {countryName || "Unassigned"} -{" "}
          <span
            className="text-ctf-gold text-xl"
            style={{ textShadow: "0 0 5px rgba(255, 215, 0, 0.5)" }}
          >
            {stars}
          </span>
        </div>

        <p className="text-ctf-primary text-base leading-relaxed m-0">
          {challenge.description}
        </p>

        <div className="flex flex-col gap-2.5">
          <div className="text-ctf-primary/70 text-base font-bold uppercase">
            Solves:
          </div>
          {detailLoading && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              Loading solves...
            </div>
          )}
          {detailError && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              Error: {detailError}
            </div>
          )}
          {detailData && (
            <div className="flex flex-col gap-2">
              {detailData.solves.length === 0 ? (
                <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
                  No solves yet
                </div>
              ) : (
                detailData.solves.map((solve, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-[12px_15px] bg-ctf-bg-item border border-ctf-border rounded transition-all duration-300 hover:border-ctf-border-hover hover:bg-ctf-bg-item-hover"
                  >
                    <span className="text-ctf-primary text-lg font-bold">
                      {solve.team}
                    </span>
                    <span className="text-ctf-primary/70 text-sm italic">
                      {formatTimeAgo(solve.solvedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
