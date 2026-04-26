import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";

import { Card } from "@/components/Card";
import { LiveActivitySidebar } from "@/components/LiveActivitySidebar";
import { PositionDisplay } from "@/components/PositionDisplay";
import { Spinner } from "@/components/Spinner";
import { useScoreboard, type TeamScore } from "@/hooks/useScoreboard";

// A list item component for all teams in the table
const TeamListItem = ({
  team,
  isActiveTeam,
}: {
  team: TeamScore;
  isActiveTeam: boolean;
}) => (
  <motion.tr
    layoutId={team.name}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="border-t border-gray-600"
  >
    <td className="p-3 text-center">
      <PositionDisplay place={team.position} />
    </td>
    <td className={`p-3 ${isActiveTeam ? "font-bold" : ""}`}>
      <Link
        to={`/score-overview/teams/${team.name}`}
        className="text-blue-500 hover:underline"
      >
        {team.name}
      </Link>
    </td>
    <td className={`p-3 text-right ${isActiveTeam ? "font-bold" : ""}`}>
      {team.score}
    </td>
    <td className={`p-3 text-right ${isActiveTeam ? "font-bold" : ""}`}>
      {team.solvedChallengeCount}
    </td>
  </motion.tr>
);

export const ScoreOverviewPage = ({
  activeTeam,
}: {
  activeTeam: string | null;
}) => {
  const { data: teams, isLoading, error } = useScoreboard();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p>
          <FormattedMessage
            id="scoreboard.loading"
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
          id="scoreboard.error"
          defaultMessage="Could not load scoreboard. Retrying..."
        />
      </p>
    );
  }

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                      id="scoreboard.header.team"
                      defaultMessage="Team"
                    />
                  </th>
                  <th className="p-4 text-xs font-medium uppercase text-right">
                    <FormattedMessage
                      id="scoreboard.header.score"
                      defaultMessage="Score"
                    />
                  </th>
                  <th className="p-4 text-xs font-medium uppercase text-right">
                    <FormattedMessage
                      id="scoreboard.header.challenges"
                      defaultMessage="Challenges"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {teams?.map((team) => (
                    <TeamListItem
                      key={team.name}
                      team={team}
                      isActiveTeam={team.name === activeTeam}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </Card>
        </LayoutGroup>
      </div>

      <div className="lg:col-span-1">
        <LiveActivitySidebar />
      </div>
    </div>
  );
};

export default ScoreOverviewPage;
