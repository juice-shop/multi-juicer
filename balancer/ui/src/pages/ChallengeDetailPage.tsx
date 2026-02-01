import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link, useParams } from "react-router-dom";

import { Card } from "@/components/Card";
import { ReadableTimestamp } from "@/components/ReadableTimestamp";
import { Spinner } from "@/components/Spinner";

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

interface ChallengeDetailData extends Omit<
  ChallengeDetailDataResponse,
  "solves"
> {
  solves: ChallengeSolve[];
}

async function fetchChallengeDetails(
  challengeKey: string,
  signal?: AbortSignal
): Promise<ChallengeDetailData> {
  const response = await fetch(`/balancer/api/challenges/${challengeKey}`, {
    signal,
  });
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

export const ChallengeDetailPage = () => {
  const { challengeKey } = useParams<{ challengeKey: string }>();
  const [challengeData, setChallengeData] =
    useState<ChallengeDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeKey) return;

    const abortController = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchChallengeDetails(
          challengeKey,
          abortController.signal
        );
        setChallengeData(data);
      } catch (err) {
        // Ignore abort errors - these are expected when component unmounts
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      abortController.abort();
    };
  }, [challengeKey]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p>
          <FormattedMessage
            id="challenge_detail.loading"
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
            id={`challenge_detail.error.${error}`}
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

      <Card className="overflow-hidden">
        {challengeData.solves.length === 0 ? (
          <>
            <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
              <FormattedMessage
                id="challenge_detail.solves_title"
                defaultMessage="Solves"
              />
            </h2>
            <p className="p-4 text-gray-500">
              <FormattedMessage
                id="challenge_detail.no_one_solved"
                defaultMessage="No one has solved this challenge yet."
              />
            </p>
          </>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-700 dark:bg-gray-100 text-gray-100 dark:text-gray-800">
              <tr>
                <th colSpan={3} className="p-4 pb-0 text-xl font-semibold">
                  <FormattedMessage
                    id="challenge_detail.solves_title"
                    defaultMessage="Solves"
                  />
                </th>
              </tr>
              <tr>
                <th className="p-4 text-xs font-medium uppercase text-center">
                  #
                </th>
                <th className="p-4 text-xs font-medium uppercase">
                  <FormattedMessage
                    id="challenge_detail.header.team"
                    defaultMessage="Team"
                  />
                </th>
                <th className="p-4 text-xs font-medium uppercase text-right">
                  <FormattedMessage
                    id="challenge_detail.header.solved"
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
                      <img
                        src="/balancer/icons/party-popper.svg"
                        alt="First Solve"
                        title="First Solve"
                        className="ml-2 inline-block h-5 w-5"
                      />
                    )}
                  </td>
                  <td className="p-3">
                    <Link
                      to={`/score-overview/teams/${solve.team}`}
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

export default ChallengeDetailPage;
