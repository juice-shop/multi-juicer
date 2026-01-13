import { useScoreboard } from "@/hooks/useScoreboard";
import { getPatternPathForTeam } from "@/lib/patterns/pattern-selector";

interface TeamsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function TeamsPanel({ isOpen, onToggle }: TeamsPanelProps) {
  const { data: teams, isLoading, error } = useScoreboard();

  return (
    <div
      className={`bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] flex flex-col transition-all duration-300 overflow-hidden shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)] ${isOpen ? "min-h-0" : ""}`}
    >
      <div
        className="p-[15px_20px] text-base font-bold uppercase tracking-[2px] cursor-pointer select-none text-ctf-primary border-b border-ctf-border flex-shrink-0 hover:text-ctf-accent"
        style={{
          textShadow: "0 0 3px rgba(255, 107, 107, 0.5)",
        }}
        onClick={onToggle}
      >
        <span
          className={`inline-block transition-transform duration-200 mr-1.5 ${isOpen ? "" : "-rotate-90"}`}
        >
          ▼
        </span>{" "}
        TEAMS
      </div>
      {isOpen && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[rgba(0,255,255,0.1)] [&::-webkit-scrollbar-thumb]:bg-ctf-primary [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:shadow-[0_0_3px_rgba(255,107,107,0.4)] [&::-webkit-scrollbar-thumb:hover]:bg-ctf-accent [&::-webkit-scrollbar-thumb:hover]:shadow-[0_0_5px_rgba(255,0,255,0.5)]">
          {isLoading && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              Loading teams...
            </div>
          )}
          {error && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              Error: {error}
            </div>
          )}
          {teams && (
            <div className="flex flex-col gap-2.5">
              {teams.map((team, index) => {
                const patternPath = getPatternPathForTeam(team.name);

                return (
                  <div
                    key={index}
                    className="flex bg-ctf-bg-item border border-ctf-border transition-all duration-300 hover:border-ctf-border-hover hover:bg-ctf-bg-item-hover overflow-hidden min-h-[60px]"
                  >
                    {/* Content section - left 67% */}
                    <div className="flex-1 p-2.5 flex flex-col justify-center">
                      <div className="text-xs font-bold uppercase tracking-[1px] text-ctf-primary mb-1.5">
                        #{team.position} {team.name}
                      </div>
                      <div className="text-[10px] text-ctf-neutral opacity-90 uppercase tracking-[1px]">
                        {team.score}pts - {team.solvedChallengeCount}{" "}
                        {team.solvedChallengeCount === 1 ? "Solve" : "Solves"}
                      </div>
                    </div>

                    {/* Pattern section - right 33% */}
                    <div className="w-1/3 flex-shrink-0 relative overflow-hidden bg-black/20">
                      {/* Rotated pattern background */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${patternPath})`,
                          backgroundSize: "30px 30px",
                          backgroundRepeat: "repeat",
                          backgroundPosition: "center",
                          transform: "rotate(45deg) scale(1.8)",
                          transformOrigin: "center",
                          imageRendering: "crisp-edges",
                        }}
                      />
                      {/* Overlay gradient for fade effect */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to left, rgba(0,0,0,0) 0%, rgba(2,2,2,0.5) 100%)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
