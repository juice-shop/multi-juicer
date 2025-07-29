import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link, useParams } from "react-router-dom";

import { Card } from "@/components/Card";
import { ReadableTimestamp } from "@/components/ReadableTimestamp";
import { Spinner } from "@/components/Spinner";

// --- Type Definitions ---
interface ChallengeSolveResponse {
  team: string;
  solvedAt: string; // ISO string
}

interface ChallengeDetailDataResponse {
  key: string;
  name: string;
  category: string;
  description: string;
  difficulty: number;
  solves: ChallengeSolveResponse[];
}

interface ChallengeSolve extends Omit<ChallengeSolveResponse, "solvedAt"> {
  solvedAt: Date; // Convert string to Date object
}

interface ChallengeDetailData
  extends Omit<ChallengeDetailDataResponse, "solves"> {
  solves: ChallengeSolve[];
}

// --- API Fetching Logic ---
async function fetchChallengeDetails(
  challengeKey: string
): Promise<ChallengeDetailData> {
  const response = await fetch(`/balancer/api/v2/challenges/${challengeKey}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Challenge not found");
    }
    throw new Error("Failed to fetch challenge details");
  }
  const rawData = (await response.json()) as ChallengeDetailDataResponse;

  // Process the raw response to convert date strings to Date objects
  return {
    ...rawData,
    solves: rawData.solves.map((solve) => ({
      ...solve,
      solvedAt: new Date(solve.solvedAt),
    })),
  };
}

// --- Main Component ---
export const ChallengeDetailPageV2 = () => {
  const { challengeKey } = useParams<{ challengeKey: string }>();
  const [challengeData, setChallengeData] =
    useState<ChallengeDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeKey) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchChallengeDetails(challengeKey);
        setChallengeData(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [challengeKey]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p>
          <FormattedMessage
            id="v2.challenge_detail.loading"
            defaultMessage="Loading Challenge Details..."
          />
        </p>
      </div>
    );
  }

  if (error || !challengeData) {
    const defaultMessage =
      error === "Challenge not found"
        ? "Challenge not found."
        : "Could not load challenge data.";
    return (
      <p className="text-red-500">
        {error ? (
          <FormattedMessage
            id={`v2.challenge_detail.error.${error}`}
            defaultMessage={defaultMessage}
          />
        ) : (
          "Could not load challenge data."
        )}
      </p>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center">
            {Array.from({ length: challengeData.difficulty }).map((_, i) => (
              <img
                key={i}
                src="/balancer/icons/star.svg"
                alt="Star"
                className="h-6 w-6"
              />
            ))}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{challengeData.name}</h1>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              {challengeData.category}
            </p>
          </div>
        </div>
        <div
          className="text-base prose dark:prose-invert"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(challengeData.description),
          }}
        />
      </Card>

      <Card>
        <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
          <FormattedMessage
            id="v2.challenge_detail.solves_title"
            defaultMessage="Solves"
          />
        </h2>
        {challengeData.solves.length === 0 ? (
          <p className="p-4 text-gray-500">
            <FormattedMessage
              id="v2.challenge_detail.no_one_solved"
              defaultMessage="No one has solved this challenge yet."
            />
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="p-3 text-center">#</th>
                <th className="p-3">
                  <FormattedMessage
                    id="v2.challenge_detail.header.team"
                    defaultMessage="Team"
                  />
                </th>
                <th className="p-3 text-right">
                  <FormattedMessage
                    id="v2.challenge_detail.header.solved"
                    defaultMessage="Solved"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {challengeData.solves.map((solve, index) => (
                <tr
                  key={solve.team}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="p-3 text-center font-mono">
                    {index + 1}
                    {index === 0 && (
                      <span className="ml-2 text-red-500" title="First Solve">
                        🎉
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <Link
                      to={`/v2/teams/${solve.team}`}
                      className="text-blue-500 hover:underline"
                    >
                      {solve.team}
                    </Link>
                  </td>
                  <td className="p-3 text-right">
                    <ReadableTimestamp date={solve.solvedAt} />
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

export default ChallengeDetailPageV2;
