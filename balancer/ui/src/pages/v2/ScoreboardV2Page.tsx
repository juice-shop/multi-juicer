import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";

import { Card } from "@/components/Card";
import { LiveActivitySidebar } from "@/components/LiveActivitySidebar";
import { Spinner } from "@/components/Spinner";

// Define the structure of a team's score data
interface TeamScore {
  name: string;
  score: number;
  position: number;
  solvedChallengeCount: number;
}

// Function to fetch the scoreboard data from the backend
async function fetchTeams(lastSeen: Date | null): Promise<TeamScore[] | null> {
  // Use the long-polling endpoint if we have a last-seen date
  const url = lastSeen
    ? `/balancer/api/score-board/top?wait-for-update-after=${lastSeen.toISOString()}`
    : "/balancer/api/score-board/top";

  const response = await fetch(url);

  // Status 204 No Content means the long-poll timed out without new data
  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to fetch scoreboard data");
  }

  const { teams } = (await response.json()) as { teams: TeamScore[] };
  return teams;
}

// A list item component for all teams in the table
const TeamListItem = ({ team }: { team: TeamScore }) => (
  <motion.tr
    layoutId={team.name}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="border-t border-gray-600"
  >
    <td className="p-3 text-center">{team.position}</td>
    <td className="p-3">
      <Link
        to={`/v2/teams/${team.name}`}
        className="text-blue-500 hover:underline"
      >
        {team.name}
      </Link>
    </td>
    <td className="p-3 text-right">{team.score}</td>
    <td className="p-3 text-right">{team.solvedChallengeCount}</td>
  </motion.tr>
);

// The main scoreboard page component
export const ScoreboardV2Page = () => {
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to keep the timeout ID stable across re-renders
  const timeoutRef = useRef<number | null>(null);

  // The core data fetching and polling logic
  // Using useRef to make this function stable across re-renders
  const updateScoreDataRef = useRef<
    ((lastSuccessfulUpdate: Date | null) => Promise<void>) | null
  >(null);

  updateScoreDataRef.current = async (lastSuccessfulUpdate: Date | null) => {
    try {
      const lastUpdateStarted = new Date();
      const newTeams = await fetchTeams(lastSuccessfulUpdate);
      if (newTeams !== null) {
        setTeams(newTeams);
      }
      setIsLoading(false);
      setError(null);

      // the request is using a http long polling mechanism to get the updates as soon as possible
      // in case the request returns immediately we wait for at least 3 seconds to ensure we aren't spamming the server
      const waitTime = Math.max(
        3000,
        5000 - (Date.now() - lastUpdateStarted.getTime())
      );
      timeoutRef.current = window.setTimeout(() => {
        updateScoreDataRef.current?.(new Date());
      }, waitTime);
    } catch (err) {
      console.error("Scoreboard fetch error:", err);
      setIsLoading(false);
      setError("Could not load scoreboard. Retrying...");
      // Retry after a delay on error
      timeoutRef.current = window.setTimeout(() => {
        updateScoreDataRef.current?.(lastSuccessfulUpdate);
      }, 5000);
    }
  };

  useEffect(() => {
    // Start the polling when the component mounts
    updateScoreDataRef.current?.(null);

    // Cleanup function to stop polling when the component unmounts
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p>
          <FormattedMessage
            id="v2.scoreboard.loading"
            defaultMessage="Loading Scoreboard..."
          />
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-red-500">
        <FormattedMessage
          id="v2.scoreboard.error"
          defaultMessage="Could not load scoreboard. Retrying..."
        />
      </p>
    );
  }

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main scoreboard content */}
      <div className="lg:col-span-2">
        <LayoutGroup>
          <Card className="overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-700 dark:bg-gray-100 text-gray-100 dark:text-gray-800">
                <tr>
                  <th className="w-12 p-4 text-xs font-medium uppercase text-center">
                    #
                  </th>
                  <th className="p-4 text-xs font-medium uppercase">
                    <FormattedMessage
                      id="v2.scoreboard.header.team"
                      defaultMessage="Team"
                    />
                  </th>
                  <th className="p-4 text-xs font-medium uppercase text-right">
                    <FormattedMessage
                      id="v2.scoreboard.header.score"
                      defaultMessage="Score"
                    />
                  </th>
                  <th className="p-4 text-xs font-medium uppercase text-right">
                    <FormattedMessage
                      id="v2.scoreboard.header.challenges"
                      defaultMessage="Challenges"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {teams.map((team) => (
                    <TeamListItem key={team.name} team={team} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </Card>
        </LayoutGroup>
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-1">
        <LiveActivitySidebar />
      </div>
    </div>
  );
};

export default ScoreboardV2Page;
