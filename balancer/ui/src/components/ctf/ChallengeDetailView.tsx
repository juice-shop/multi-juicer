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
    <div className="challenge-detail-view">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      <div className="challenge-detail-content">
        <h2 className="challenge-detail-name">{challenge.name}</h2>

        <div className="challenge-detail-meta">
          {countryName || "Unassigned"} -{" "}
          <span className="difficulty-stars">{stars}</span>
        </div>

        <p className="description-text">{challenge.description}</p>

        <div className="challenge-detail-solves">
          <div className="field-label">Solves:</div>
          {detailLoading && (
            <div className="panel-placeholder">Loading solves...</div>
          )}
          {detailError && (
            <div className="panel-placeholder">Error: {detailError}</div>
          )}
          {detailData && (
            <div className="solves-list">
              {detailData.solves.length === 0 ? (
                <div className="panel-placeholder">No solves yet</div>
              ) : (
                detailData.solves.map((solve, index) => (
                  <div key={index} className="solve-item">
                    <span className="team-name">{solve.team}</span>
                    <span className="solve-time">
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
