import { useScoreboard } from "@/hooks/useScoreboard";

interface TeamsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function TeamsPanel({ isOpen, onToggle }: TeamsPanelProps) {
  const { data: teams, isLoading, error } = useScoreboard();

  return (
    <div className={`side-panel teams-panel ${isOpen ? "open" : "collapsed"}`}>
      <div className="panel-header" onClick={onToggle}>
        <span className={`arrow ${isOpen ? "open" : ""}`}>▼</span> TEAMS
      </div>
      {isOpen && (
        <div className="panel-content">
          {isLoading && (
            <div className="panel-placeholder">Loading teams...</div>
          )}
          {error && <div className="panel-placeholder">Error: {error}</div>}
          {teams && (
            <div className="teams-list">
              {teams.map((team, index) => (
                <div key={index} className="team-item">
                  <div className="team-row-1">
                    #{team.position} {team.name}
                  </div>
                  <div className="team-row-2">
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
