import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Spinner } from "../components/Spinner";

interface IndividualTeamScore {
  name: string;
  score: string;
  position: number;
  totalTeams: number;
  solvedChallenges: string[];
}

async function fetchScore(team: string): Promise<IndividualTeamScore> {
  const response = await fetch(`/balancer/api/score-board/teams/${team}/score`);
  return await response.json();
}

export function IndividualScorePage() {
  const { team } = useParams();

  if (!team) {
    return <div>Team not found</div>;
  }

  const [score, setScore] = useState<IndividualTeamScore | null>(null);
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
      <div className="p-0 overflow-hidden w-full max-w-2xl rounded-lg bg-gradient-to-b from-gray-100 via-gray-100 to-gray-500">
        <h1 className="text-gray-500 px-4 pt-4 font-bold tracking-wide">
          Solved Challenges for <strong>{team}</strong>
        </h1>
        <table className="w-full text-left border-collapse">
          <thead className="w-full border-none bg-gray-100 text-gray-800">
            <tr className="w-full">
              <th
                scope="col"
                className="p-3 text-gray-500 text-xs font-medium uppercase"
              >
                Name
              </th>
            </tr>
          </thead>
          <tbody className="w-full dark:bg-gray-800">
            {score.solvedChallenges.length === 0 && (
              <tr className="border-t border-gray-600">
                <td className="p-2">No challenges solved yet</td>
              </tr>
            )}
            {score.solvedChallenges.map((challenge) => {
              return (
                <tr className="border-t border-gray-600" key={challenge}>
                  <td className="p-2">{challenge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
