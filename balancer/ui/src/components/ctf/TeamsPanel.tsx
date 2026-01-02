import { useScoreboard } from "@/hooks/useScoreboard";

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
              {teams.map((team, index) => (
                <div
                  key={index}
                  className="p-2.5 bg-ctf-bg-item border border-ctf-border transition-all duration-300 hover:border-ctf-border-hover hover:bg-ctf-bg-item-hover"
                >
                  <div className="text-xs font-bold uppercase tracking-[1px] text-ctf-primary mb-1.5">
                    #{team.position} {team.name}
                  </div>
                  <div className="text-[10px] text-ctf-neutral opacity-90 uppercase tracking-[1px]">
                    {team.score}pts - {team.solvedChallengeCount}{" "}
                    {team.solvedChallengeCount === 1 ? "Solve" : "Solves"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
