import { useState, useEffect } from "react";
import { injectIntl } from "react-intl";

import { Card } from "../Components";

function FirstPlace({ ...props }) {
  return <img src="/balancer/icons/first-place.svg" height="32" {...props} />;
}

function SecondPlace({ ...props }) {
  return <img src="/balancer/icons/second-place.svg" height="32" {...props} />;
}

function ThirdPlace({ ...props }) {
  return <img src="/balancer/icons/third-place.svg" height="32" {...props} />;
}

function PlaceDisplay({ place }: { place: number }) {
  switch (place) {
    case 1:
      return <FirstPlace height="32" />;
    case 2:
      return <SecondPlace height="32" />;
    case 3:
      return <ThirdPlace height="32" />;
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
  challenges: string[];
}

async function fetchTeams(): Promise<Team[]> {
  const response = await fetch("/balancer/api/score-board/top");
  const { teams } = await response.json();
  return teams;
}

export const ScoreBoard = injectIntl(() => {
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

  return (
    <>
      <Card className="p-0 overflow-hidden w-full max-w-2xl">
        <table className="w-full text-left border-collapse">
          <thead className="w-full border-none bg-gray-100 text-gray-800">
            <tr className="w-full">
              <th
                scope="col"
                className="text-center w-12 p-3 text-gray-500 text-xs font-medium uppercase"
              >
                #
              </th>
              <th
                scope="col"
                className="p-3 text-gray-500 text-xs font-medium uppercase"
              >
                Name
              </th>
              <th
                scope="col"
                className="text-right p-3 text-gray-500 text-xs font-medium uppercase"
              >
                Score
              </th>
            </tr>
          </thead>
          <tbody className="w-full">
            {teams.map((team, index) => {
              return (
                <tr className="border-t border-gray-600">
                  <td className="text-center p-2">
                    <PlaceDisplay place={index + 1}></PlaceDisplay>
                  </td>
                  <td className="p-2">{team.name}</td>
                  <td className="text-right p-2">
                    {team.score} points
                    <p className="text-gray-500 m-1">
                      {team.challenges.length} solved challenges
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
});