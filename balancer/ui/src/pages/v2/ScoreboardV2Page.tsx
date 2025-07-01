import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FormattedMessage } from "react-intl";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Spinner } from "../../components/Spinner";
import { PositionDisplay } from "../../components/PositionDisplay";
import { Card } from "../../components/Card";
import { LiveActivitySidebar } from "../../components/LiveActivitySidebar";

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

// A card component for the top 3 teams
const TopTeamCard = ({ team, rank }: { team: TeamScore; rank: number }) => (
  <motion.div layoutId={team.name} className="w-full">
    <Link to={`/v2/teams/${team.name}`} className="block hover:scale-105 transition-transform duration-200">
      <Card className="flex flex-col items-center p-4 bg-gray-700 dark:bg-gray-100 text-white shadow-lg">
        <div className="text-3xl mb-2">
          <PositionDisplay place={rank} />
        </div>
        <h3 className="text-xl font-bold">{team.name}</h3>
        <p className="text-lg">{team.score} pts</p>
        <p className="text-sm opacity-80">{team.solvedChallengeCount} challenges</p>
      </Card>
    </Link>
  </motion.div>
);

// A list item component for the other teams
const TeamListItem = ({ team }: { team: TeamScore }) => (
  <motion.tr
    layoutId={team.name}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="border-b border-gray-200 dark:border-gray-700"
  >
    <td className="p-3 text-center">{team.position}</td>
    <td className="p-3">
      <Link to={`/v2/teams/${team.name}`} className="text-blue-500 hover:underline">
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
  const updateScoreData = async (lastSuccessfulUpdate: Date | null) => {
    try {
      const newTeams = await fetchTeams(lastSuccessfulUpdate);
      if (newTeams !== null) {
        setTeams(newTeams);
      }
      setIsLoading(false);
      setError(null);
      // Schedule the next poll
      timeoutRef.current = window.setTimeout(() => updateScoreData(new Date()), 1000);
    } catch (err) {
      console.error("Scoreboard fetch error:", err);
      setError("Could not load scoreboard. Retrying...");
      // Retry after a delay on error
      timeoutRef.current = window.setTimeout(() => updateScoreData(lastSuccessfulUpdate), 5000);
    }
  };

  useEffect(() => {
    // Start the polling when the component mounts
    updateScoreData(null);

    // Cleanup function to stop polling when the component unmounts
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p><FormattedMessage id="v2.scoreboard.loading" defaultMessage="Loading Scoreboard..." /></p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500"><FormattedMessage id="v2.scoreboard.error" defaultMessage="Could not load scoreboard. Retrying..." /></p>;
  }

  const topThree = teams.slice(0, 3);
  const otherTeams = teams.slice(3);

  return (
  <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
    {/* Main scoreboard content */}
    <div className="lg:col-span-2">
      <h1 className="text-3xl font-bold text-center mb-6">
        <FormattedMessage id="v2.scoreboard.title" defaultMessage="Live Scoreboard" />
      </h1>

      <LayoutGroup>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <AnimatePresence>
            {topThree.map((team) => (
              <TopTeamCard key={team.name} team={team} rank={team.position} />
            ))}
          </AnimatePresence>
        </div>

        <Card>
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="p-3 text-center">#</th>
                <th className="p-3"><FormattedMessage id="v2.scoreboard.header.team" defaultMessage="Team" /></th>
                <th className="p-3 text-right"><FormattedMessage id="v2.scoreboard.header.score" defaultMessage="Score" /></th>
                <th className="p-3 text-right"><FormattedMessage id="v2.scoreboard.header.challenges" defaultMessage="Challenges" /></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {otherTeams.map((team) => (
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