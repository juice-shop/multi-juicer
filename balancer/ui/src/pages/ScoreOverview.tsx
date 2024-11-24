import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MagicMotion } from "react-magic-motion";

function FirstPlace({ ...props }) {
  return <img src="/balancer/icons/first-place.svg" {...props} />;
}

function SecondPlace({ ...props }) {
  return <img src="/balancer/icons/second-place.svg" {...props} />;
}

function ThirdPlace({ ...props }) {
  return <img src="/balancer/icons/third-place.svg" {...props} />;
}

export function PositionDisplay({ place }: { place: number }) {
  switch (place) {
    case 1:
      return <FirstPlace className="h-10" />;
    case 2:
      return <SecondPlace className="h-10" />;
    case 3:
      return <ThirdPlace className="h-10" />;
    default:
      return (
        <>
          <small>#</small>
          {place}
        </>
      );
  }
}

interface Team {
  name: string;
  score: number;
  position: number;
  challenges: string[];
}

async function fetchTeams(): Promise<Team[]> {
  const response = await fetch(
    `/balancer/api/score-board/top?wait-for-update-after=${new Date().toISOString()}`
  );
  const { teams } = await response.json();
  return teams;
}

export function ScoreOverviewPage({
  activeTeam,
}: {
  activeTeam: string | null;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    fetchTeams().then(setTeams);

    const timer = setInterval(() => {
      fetchTeams().then(setTeams);
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, []);
  const [lastUpdateStarted, setLastUpdateStarted] = useState(Date.now());

  let timeout: number | null = null;
  async function updateScoreData() {
    try {
      setLastUpdateStarted(Date.now());
      const status = await fetchTeams();
      setTeams(status);

      // the request is using a http long polling mechanism to get the updates as soon as possible
      // in case the request returns immediatly we wait for at least 3 seconds to ensure we aren't spamming the server
      const waitTime = Math.max(3000, 5000 - (Date.now() - lastUpdateStarted));
      console.log(
        "Waited for",
        Date.now() - lastUpdateStarted,
        "ms for status update"
      );
      console.log("Waiting for", waitTime, "ms until starting next request");
      timeout = window.setTimeout(() => updateScoreData(), waitTime);
    } catch (err) {
      console.error("Failed to fetch current teams!", err);
    }
  }

  useEffect(() => {
    updateScoreData();
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return (
    <>
      <div className="p-0 overflow-hidden w-full max-w-2xl rounded-lg bg-gradient-to-b from-gray-100 via-gray-100 to-gray-500">
        <h1 className="text-gray-500 px-4 pt-4 font-bold tracking-wide">
          ScoreBoard
        </h1>
        <table className="w-full text-left border-collapse">
          <thead className="w-full border-none bg-gray-100 text-gray-800">
            <tr className="w-full">
              <th
                scope="col"
                className="w-12 p-4 text-gray-500 text-xs font-medium uppercase"
              >
                #
              </th>
              <th
                scope="col"
                className="p-4 text-gray-500 text-xs font-medium uppercase"
              >
                Name
              </th>
              <th
                scope="col"
                className="text-right p-4 text-gray-500 text-xs font-medium uppercase"
              >
                Score
              </th>
            </tr>
          </thead>
          <tbody className="w-full dark:bg-gray-800">
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
                          {team.challenges.length} solved challenges
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
