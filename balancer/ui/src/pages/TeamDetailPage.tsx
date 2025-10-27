import { useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";

import { Card } from "@/components/Card";
import { PositionDisplay } from "@/components/PositionDisplay";
import { ReadableTimestamp } from "@/components/ReadableTimestamp";
import { Spinner } from "@/components/Spinner";

// --- Type Definitions ---
interface SolvedChallengeResponse {
  key: string;
  name: string;
  difficulty: number;
  solvedAt: string; // ISO string
}

interface IndividualTeamScoreResponse {
  name: string;
  score: number;
  position: number;
  totalTeams: number;
  solvedChallenges: SolvedChallengeResponse[];
}

interface SolvedChallenge extends Omit<SolvedChallengeResponse, "solvedAt"> {
  solvedAt: Date; // Convert string to Date object
}

interface IndividualTeamScore
  extends Omit<IndividualTeamScoreResponse, "solvedChallenges"> {
  solvedChallenges: SolvedChallenge[];
}

// --- API Fetching Logic ---
async function fetchTeamScore(
  team: string,
  lastSeen: Date | null,
  signal?: AbortSignal
): Promise<IndividualTeamScore | null> {
  const url = lastSeen
    ? `/balancer/api/score-board/teams/${team}/score?wait-for-update-after=${lastSeen.toISOString()}`
    : `/balancer/api/score-board/teams/${team}/score`;

  const response = await fetch(url, { signal });

  if (response.status === 204) {
    // No new data from long-poll
    return null;
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Team not found");
    }
    throw new Error("Failed to fetch team score");
  }
  const rawScore = (await response.json()) as IndividualTeamScoreResponse;

  // Process the raw response to convert date strings to Date objects and sort
  return {
    ...rawScore,
    solvedChallenges: rawScore.solvedChallenges
      .map((challenge) => ({
        ...challenge,
        solvedAt: new Date(challenge.solvedAt),
      }))
      .sort((a, b) => b.solvedAt.getTime() - a.solvedAt.getTime()), // Sort by most recent first
  };
}

// --- Main Component ---
export const TeamDetailPage = () => {
  const { team } = useParams<{ team: string }>();
  const intl = useIntl();
  const [teamScore, setTeamScore] = useState<IndividualTeamScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null); // To manage polling timeout

  // The core data fetching and polling logic
  // Using useRef to make this function stable across re-renders
  const updateAndPollRef = useRef<
    | ((
        lastSuccessfulUpdate: Date | null,
        signal: AbortSignal
      ) => Promise<void>)
    | null
  >(null);

  updateAndPollRef.current = async (
    lastSuccessfulUpdate: Date | null,
    signal: AbortSignal
  ) => {
    try {
      const lastUpdateStarted = new Date();
      const data = await fetchTeamScore(team!, lastSuccessfulUpdate, signal);

      if (data !== null) {
        setTeamScore(data);
      }
      if (isLoading) setIsLoading(false); // Only set loading to false on first successful fetch
      setError(null);

      // the request is using a http long polling mechanism to get the updates as soon as possible
      // in case the request returns immediately we wait for at least 3 seconds to ensure we aren't spamming the server
      const waitTime = Math.max(
        3000,
        5000 - (Date.now() - lastUpdateStarted.getTime())
      );
      timeoutRef.current = window.setTimeout(() => {
        updateAndPollRef.current?.(new Date(), signal);
      }, waitTime);
    } catch (err) {
      // Ignore abort errors - these are expected when component unmounts
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      setError((err as Error).message);
      if (isLoading) setIsLoading(false);

      // Retry after a longer delay on error
      timeoutRef.current = window.setTimeout(() => {
        updateAndPollRef.current?.(lastSuccessfulUpdate, signal);
      }, 5000);
    }
  };

  useEffect(() => {
    if (!team) return;

    const abortController = new AbortController();

    // Start the initial fetch and polling loop
    updateAndPollRef.current?.(null, abortController.signal);

    // Cleanup function to stop polling when the component unmounts
    return () => {
      abortController.abort();
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [team]);

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

  if (error || !teamScore) {
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
            <PositionDisplay place={teamScore.position} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{teamScore.name}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              <FormattedMessage
                id="team_detail.rank"
                defaultMessage="Rank {position} of {totalTeams}"
                values={{
                  position: teamScore.position,
                  totalTeams: teamScore.totalTeams,
                }}
              />
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
          <FormattedMessage
            id="team_detail.solved_challenges"
            defaultMessage="Solved Challenges"
          />
        </h2>
        {teamScore.solvedChallenges.length === 0 ? (
          <p className="p-4 text-gray-500">
            <FormattedMessage
              id="team_detail.no_solves"
              defaultMessage="No challenges solved yet."
            />
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="p-3">
                  <FormattedMessage
                    id="team_detail.header.challenge"
                    defaultMessage="Challenge"
                  />
                </th>
                <th className="p-3 text-center">
                  <FormattedMessage
                    id="team_detail.header.difficulty"
                    defaultMessage="Difficulty"
                  />
                </th>
                <th className="p-3 text-right">
                  <FormattedMessage
                    id="team_detail.header.solved"
                    defaultMessage="Solved"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {teamScore.solvedChallenges.map((challenge) => (
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
