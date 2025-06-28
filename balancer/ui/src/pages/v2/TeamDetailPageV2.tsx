import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { FormattedMessage, useIntl } from "react-intl";
import { Spinner } from "../../components/Spinner";
import { Card } from "../../components/Card";
import { ReadableTimestamp } from "../../components/ReadableTimestamp";
import { PositionDisplay } from "../../components/PositionDisplay";

interface SolvedChallengeResponse {
  key: string;
  name: string;
  difficulty: number;
  solvedAt: string;
}

interface IndividualTeamScoreResponse {
  name: string;
  score: number;
  position: number;
  totalTeams: number;
  solvedChallenges: SolvedChallengeResponse[];
}

interface SolvedChallenge extends Omit<SolvedChallengeResponse, "solvedAt"> {
  solvedAt: Date;
}

interface IndividualTeamScore extends Omit<IndividualTeamScoreResponse, "solvedChallenges"> {
  solvedChallenges: SolvedChallenge[];
}

// API Fetching Logic
async function fetchTeamScore(team: string): Promise<IndividualTeamScore> {
  const response = await fetch(`/balancer/api/score-board/teams/${team}/score`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Team not found");
    }
    throw new Error("Failed to fetch team score");
  }
  const rawScore = (await response.json()) as IndividualTeamScoreResponse;

  // Process the raw response to convert date strings to Date objects
  return {
    ...rawScore,
    solvedChallenges: rawScore.solvedChallenges.map((challenge) => ({
      ...challenge,
      solvedAt: new Date(challenge.solvedAt),
    })).sort((a, b) => b.solvedAt.getTime() - a.solvedAt.getTime()), // Sort by most recent first
  };
}

// --- Main Component ---
export const TeamDetailPageV2 = () => {
  const { team } = useParams<{ team: string }>();
  const intl = useIntl();
  const [teamScore, setTeamScore] = useState<IndividualTeamScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!team) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchTeamScore(team);
        setTeamScore(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [team]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p><FormattedMessage id="v2.team_detail.loading" defaultMessage="Loading Team Details..." /></p>
      </div>
    );
  }

  if (error || !teamScore) {
    return <p className="text-red-500">{error || "Could not load team data."}</p>;
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="text-4xl">
            <PositionDisplay place={teamScore.position} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{teamScore.name}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              <FormattedMessage
                id="v2.team_detail.rank"
                defaultMessage="Rank {position} of {totalTeams}"
                values={{ position: teamScore.position, totalTeams: teamScore.totalTeams }}
              />
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
          <FormattedMessage id="v2.team_detail.solved_challenges" defaultMessage="Solved Challenges" />
        </h2>
        {teamScore.solvedChallenges.length === 0 ? (
          <p className="p-4 text-gray-500">
            <FormattedMessage id="v2.team_detail.no_solves" defaultMessage="No challenges solved yet." />
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="p-3"><FormattedMessage id="v2.team_detail.header.challenge" defaultMessage="Challenge" /></th>
                <th className="p-3 text-center"><FormattedMessage id="v2.team_detail.header.difficulty" defaultMessage="Difficulty" /></th>
                <th className="p-3 text-right"><FormattedMessage id="v2.team_detail.header.solved" defaultMessage="Solved" /></th>
              </tr>
            </thead>
            <tbody>
              {teamScore.solvedChallenges.map((challenge) => (
                <tr key={challenge.key} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3">
                    <Link to={`/v2/challenges/${challenge.key}`} className="text-blue-500 hover:underline">
                      {challenge.name}
                    </Link>
                  </td>
                  <td
                    className="p-3 text-center"
                    title={intl.formatMessage({ id: "difficulty", defaultMessage: "Difficulty: {difficulty}/6" }, { difficulty: challenge.difficulty })}
                  >
                    <div className="flex justify-center items-center">
                      {Array.from({ length: challenge.difficulty }).map((_, i) => (
                        <img key={i} src="/balancer/icons/star.svg" alt="Star" className="h-4 w-4" />
                      ))}
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

export default TeamDetailPageV2;