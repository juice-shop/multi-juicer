import { useActivityFeed } from "@/hooks/useActivityFeed";
import type { ChallengeCountryMapping } from "@/lib/challenges/challenge-mapper";

interface LiveActivityPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  challengeMappings: ChallengeCountryMapping[];
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export function LiveActivityPanel({
  isOpen,
  onToggle,
  challengeMappings,
}: LiveActivityPanelProps) {
  const { data: activities, isLoading, error } = useActivityFeed();

  // Create a map from challengeKey to countryName for fast lookup
  const challengeToCountry = new Map<string, string | null>();
  for (const mapping of challengeMappings) {
    challengeToCountry.set(mapping.challenge.key, mapping.countryName);
  }

  return (
    <div
      className={`side-panel activity-panel ${isOpen ? "open" : "collapsed"}`}
    >
      <div className="panel-header" onClick={onToggle}>
        <span className={`arrow ${isOpen ? "open" : ""}`}>▼</span> LIVE ACTIVITY
      </div>
      {isOpen && (
        <div className="panel-content">
          {isLoading && (
            <div className="panel-placeholder">Loading activity...</div>
          )}
          {error && <div className="panel-placeholder">Error: {error}</div>}
          {activities && (
            <div className="activity-list">
              {activities.map((activity, index) => {
                const countryName = challengeToCountry.get(
                  activity.challengeKey
                );
                const challengeDisplay = countryName
                  ? `${activity.challengeName} (${countryName})`
                  : activity.challengeName;

                return (
                  <div key={index} className="activity-item">
                    <div className="activity-row-1">
                      {activity.team} solved {challengeDisplay} (+
                      {activity.points} pts)
                    </div>
                    <div className="activity-row-2">
                      {formatTimeAgo(activity.solvedAt)}
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
