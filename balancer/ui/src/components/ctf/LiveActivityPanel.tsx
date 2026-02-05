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
        LIVE ACTIVITY
      </div>
      {isOpen && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[rgba(0,255,255,0.1)] [&::-webkit-scrollbar-thumb]:bg-ctf-primary [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:shadow-[0_0_3px_rgba(255,107,107,0.4)] [&::-webkit-scrollbar-thumb:hover]:bg-ctf-accent [&::-webkit-scrollbar-thumb:hover]:shadow-[0_0_5px_rgba(255,0,255,0.5)]">
          {isLoading && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              Loading activity...
            </div>
          )}
          {error && (
            <div className="text-xs opacity-70 p-2.5 text-ctf-neutral">
              Error: {error}
            </div>
          )}
          {activities && (
            <div className="flex flex-col gap-1.5">
              {activities.map((activity, index) => {
                if (activity.eventType === "team_created") {
                  return (
                    <div key={index} className="py-1.5">
                      <div className="text-[11px] text-ctf-primary mb-0.5 leading-[1.4]">
                        "{activity.team}" team joined the CTF
                      </div>
                      <div className="text-[9px] text-ctf-neutral opacity-70">
                        {formatTimeAgo(activity.timestamp)}
                      </div>
                    </div>
                  );
                }
                // Challenge solved event
                const countryName = challengeToCountry.get(
                  activity.challengeKey!
                );
                const challengeDisplay = countryName
                  ? `${activity.challengeName} (${countryName})`
                  : activity.challengeName;

                return (
                  <div key={index} className="py-1.5">
                    <div className="text-[11px] text-ctf-primary mb-0.5 leading-[1.4]">
                      {activity.team} solved {challengeDisplay} (+
                      {activity.points} pts)
                    </div>
                    <div className="text-[9px] text-ctf-neutral opacity-70">
                      {formatTimeAgo(activity.timestamp)}
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
