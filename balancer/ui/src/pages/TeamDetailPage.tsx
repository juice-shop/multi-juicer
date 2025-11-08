import { FormattedMessage, useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";

import { Card } from "@/components/Card";
import { PositionDisplay } from "@/components/PositionDisplay";
import { ReadableTimestamp } from "@/components/ReadableTimestamp";
import { Spinner } from "@/components/Spinner";
import { useTeamStatus } from "@/hooks/useTeamStatus";

// --- Main Component ---
export const TeamDetailPage = () => {
  const { team } = useParams<{ team: string }>();
  const intl = useIntl();
  const { data: teamStatus, isLoading, error } = useTeamStatus(team!);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p>
          <FormattedMessage
            id="team_detail.loading"
            defaultMessage="Loading Team Details..."
          />
        </p>
      </div>
    );
  }

  if (error || !teamStatus) {
    const defaultMessage =
      error === "Team not found"
        ? "Team not found."
        : "Could not load team data.";
    return (
      <p className="text-red-500">
        {error ? (
          <FormattedMessage
            id={`team_detail.error.${error}`}
            defaultMessage={defaultMessage}
          />
        ) : (
          "Could not load team data."
        )}
      </p>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="text-4xl">
            <PositionDisplay place={teamStatus.position} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{teamStatus.name}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              <FormattedMessage
                id="team_detail.rank"
                defaultMessage="Rank {position} of {totalTeams}"
                values={{
                  position: teamStatus.position,
                  totalTeams: teamStatus.totalTeams,
                }}
              />
            </p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {teamStatus.solvedChallenges.length === 0 ? (
          <>
            <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
              <FormattedMessage
                id="team_detail.solved_challenges"
                defaultMessage="Solved Challenges"
              />
            </h2>
            <p className="p-4 text-gray-500">
              <FormattedMessage
                id="team_detail.no_solves"
                defaultMessage="No challenges solved yet."
              />
            </p>
          </>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-700 dark:bg-gray-100 text-gray-100 dark:text-gray-800">
              <tr>
                <th colSpan={3} className="p-4 pb-0 text-xl font-semibold">
                  <FormattedMessage
                    id="team_detail.solved_challenges"
                    defaultMessage="Solved Challenges"
                  />
                </th>
              </tr>
              <tr>
                <th className="p-4 text-xs font-medium uppercase">
                  <FormattedMessage
                    id="team_detail.header.challenge"
                    defaultMessage="Challenge"
                  />
                </th>
                <th className="p-4 text-xs font-medium uppercase text-center">
                  <FormattedMessage
                    id="team_detail.header.difficulty"
                    defaultMessage="Difficulty"
                  />
                </th>
                <th className="p-4 text-xs font-medium uppercase text-right">
                  <FormattedMessage
                    id="team_detail.header.solved"
                    defaultMessage="Solved"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {teamStatus.solvedChallenges.map((challenge) => (
                <tr
                  key={challenge.key}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="p-3">
                    <Link
                      to={`/score-overview/challenges/${challenge.key}`}
                      className="text-blue-500 hover:underline"
                    >
                      {challenge.name}
                    </Link>
                  </td>
                  <td
                    className="p-3 text-center"
                    title={intl.formatMessage(
                      {
                        id: "difficulty",
                        defaultMessage: "Difficulty: {difficulty}/6",
                      },
                      { difficulty: challenge.difficulty }
                    )}
                  >
                    <div className="flex justify-center items-center">
                      {Array.from({ length: challenge.difficulty }).map(
                        (_, i) => (
                          <img
                            key={i}
                            src="/balancer/icons/star.svg"
                            alt="Star"
                            className="h-4 w-4"
                          />
                        )
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <ReadableTimestamp date={challenge.solvedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

export default TeamDetailPage;
