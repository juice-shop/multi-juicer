import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MagicMotion } from "react-magic-motion";
import { PositionDisplay } from "../components/PositionDisplay";

interface Team {
  name: string;
  score: number;
  position: number;
  solvedChallengeCount: number;
}

async function fetchTeams(lastSeen: Date | null): Promise<null | Team[]> {
  const url = lastSeen
    ? `/balancer/api/score-board/top?wait-for-update-after=${lastSeen.toISOString()}`
    : "/balancer/api/score-board/top";
  const response = await fetch(url);

  if (response.status === 204) {
    return null;
  }

  const { teams } = await response.json();
  return teams;
}

export default function ScoreOverviewPage({
  activeTeam,
}: {
  activeTeam: string | null;
}) {
  const [teams, setTeams] = useState<Team[]>([]);

  let timeout: number | null = null;
  const updateScoreData = async (lastSuccessfulUpdate: Date | null) => {
    try {
      const lastUpdateStarted = new Date();
      const status = await fetchTeams(lastSuccessfulUpdate);
      if (status !== null) {
        setTeams(status);
      }

      // the request is using a http long polling mechanism to get the updates as soon as possible
      // in case the request returns immediatly we wait for at least 3 seconds to ensure we aren't spamming the server
      const waitTime = Math.max(
        3000,
        5000 - (Date.now() - lastUpdateStarted.getTime())
      );
      console.log(
        "Waited for",
        Date.now() - lastUpdateStarted.getTime(),
        "ms for status update"
      );
      console.log("Waiting for", waitTime, "ms until starting next request");
      timeout = window.setTimeout(() => updateScoreData(new Date()), waitTime);
    } catch (err) {
      console.error("Failed to fetch current teams!", err);
    }
  };

  useEffect(() => {
    updateScoreData(null);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return (
    <>
      <link rel="preload" href="/balancer/icons/first-place.svg" as="image" />
      <link rel="preload" href="/balancer/icons/second-place.svg" as="image" />
      <link rel="preload" href="/balancer/icons/third-place.svg" as="image" />
      <div className="p-0 overflow-hidden w-full max-w-2xl rounded-lg bg-gradient-to-b from-gray-700 via-gray-700 to-gray-200 dark:from-gray-100 dark:via-gray-100 dark:to-gray-500 shadow">
        <h1 className="px-4 pt-4 font-bold tracking-wide text-gray-100 dark:text-gray-800 ">
          ScoreBoard
        </h1>
        <table className="w-full text-left border-collapse">
          <thead className="w-full border-none bg-gray-700 dark:bg-gray-100 text-gray-100 dark:text-gray-800 ">
            <tr className="w-full">
              <th
                scope="col"
                className="w-12 p-4 text-xs font-medium uppercase"
              >
                #
              </th>
              <th scope="col" className="p-4 text-xs font-medium uppercase">
                Name
              </th>
              <th
                scope="col"
                className="text-right p-4 text-xs font-medium uppercase"
              >
                Score
              </th>
            </tr>
          </thead>
          <tbody className="w-full dark:bg-gray-800 bg-gray-100">
            <MagicMotion>
              <>
                {teams.map((team) => {
                  return (
                    <tr className="border-t border-gray-600" key={team.name}>
                      <td className="text-center p-2 px-3">
                        <PositionDisplay place={team.position} />
                      </td>
                      <td className="p-2 px-4">
                        <Link to={`/score-overview/teams/${team.name}`}>
                          {team.name === activeTeam ? (
                            <strong>{team.name}</strong>
                          ) : (
                            team.name
                          )}
                        </Link>
                      </td>
                      <td className="text-right text-s p-2 px-4">
                        {team.score} points
                        <p className="text-gray-500 m-1">
                          {team.solvedChallengeCount} solved challenges
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </>
            </MagicMotion>
          </tbody>
        </table>
      </div>
    </>
  );
}
