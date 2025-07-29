import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useParams } from "react-router-dom";

import { ReadableTimestamp } from "@/components/ReadableTimestamp";
import { Spinner } from "@/components/Spinner";

interface IndividualTeamScore<T> {
  name: string;
  score: string;
  position: number;
  totalTeams: number;
  solvedChallenges: T[];
}

interface SolvedChallengeResponse {
  key: string;
  solvedAt: string;
  name: string;
  difficulty: number;
}
interface SolvedChallenge {
  key: string;
  solvedAt: Date;
  name: string;
  difficulty: number;
}

async function fetchScore(
  team: string
): Promise<IndividualTeamScore<SolvedChallenge>> {
  const response = await fetch(`/balancer/api/score-board/teams/${team}/score`);
  const rawScore =
    (await response.json()) as IndividualTeamScore<SolvedChallengeResponse>;
  return {
    ...rawScore,
    solvedChallenges: rawScore.solvedChallenges.map((challenge) => {
      return {
        ...challenge,
        solvedAt: new Date(challenge.solvedAt),
      };
    }),
  };
}

export default function IndividualScorePage() {
  const { team } = useParams();
  const intl = useIntl();

  if (!team) {
    return <div>Team not found</div>;
  }

  const [score, setScore] =
    useState<IndividualTeamScore<SolvedChallenge> | null>(null);
  useEffect(() => {
    fetchScore(team).then(setScore);

    const timer = setInterval(() => {
      fetchScore(team).then(setScore);
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  if (score === null) {
    return <Spinner />;
  }

  return (
    <>
      <div className="p-0 overflow-hidden w-full max-w-2xl rounded-lg bg-linear-to-b from-gray-700 via-gray-700 to-gray-200 dark:from-gray-100 dark:via-gray-100 dark:to-gray-500 shadow-sm">
        <h1 className="px-4 pt-4 font-bold tracking-wide text-gray-100 dark:text-gray-800 ">
          Solved Challenges for <strong>{team}</strong>
        </h1>
        <table className="w-full text-left border-collapse">
          <thead className="w-full border-none bg-gray-700 dark:bg-gray-100 text-gray-100 dark:text-gray-800 ">
            <tr className="w-full">
              <th scope="col" className="p-4 text-xs font-medium uppercase">
                Name
              </th>
              <th
                scope="col"
                className="p-4 text-xs text-right font-medium uppercase"
              >
                Difficulty
              </th>
              <th
                scope="col"
                className="p-4 text-xs text-right font-medium uppercase"
              >
                Solved At
              </th>
            </tr>
          </thead>
          <tbody className="w-full dark:bg-gray-800 bg-gray-100">
            {score.solvedChallenges.length === 0 && (
              <tr className="border-t border-gray-600">
                <td className="p-2">
                  <FormattedMessage
                    id="no_challenges_solved"
                    defaultMessage="No challenges solved yet"
                  />
                </td>
                <td className="p-2 text-right"></td>
                <td className="p-2 text-right"></td>
              </tr>
            )}
            {score.solvedChallenges.map((challenge) => {
              return (
                <tr className="border-t border-gray-600" key={challenge.key}>
                  <td className="p-2 px-4">{challenge.name}</td>
                  <td
                    className="p-2 px-4"
                    title={intl.formatMessage(
                      {
                        id: "difficulty",
                        defaultMessage: "Difficulty: {difficulty}/6",
                      },
                      { difficulty: challenge.difficulty }
                    )}
                  >
                    <div className="h-full flex justify-end items-center">
                      {Array.from({ length: challenge.difficulty }, (_, i) => (
                        <img
                          src="/balancer/icons/star.svg"
                          alt="Star"
                          key={i}
                          height={12}
                          width={12}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-2 px-4 text-right">
                    <ReadableTimestamp date={challenge.solvedAt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
