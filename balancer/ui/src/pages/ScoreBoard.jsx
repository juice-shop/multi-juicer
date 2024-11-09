import React, { useState, useEffect } from "react";
import { injectIntl } from "react-intl";

import { Card } from "../Components";

function FirstPlace(props) {
  return (
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path fill="#fcea2b" d="M28.057 22.427V17h15.858v5.427" />
      <path
        fill="#92d3f5"
        stroke="#92d3f5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.8}
        d="M54.999 4.022L43 16.021h-7l-5.042-5.042 6.963-6.962h17.078"
      />
      <path
        fill="#ea5a47"
        stroke="#ea5a47"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.8}
        d="M23.983 4.004L36 16.02h-7L16.968 3.988h7.015"
      />
      <circle cx={36} cy={44.975} r={23} fill="#fcea2b" />
      <g fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth={2}>
        <circle cx={36} cy={44.975} r={23} />
        <circle
          cx={36}
          cy={44.975}
          r={23}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M29 19v-2.979M43 19v-2.979M29 16.021h14M25.99 13.01l-9.022-9.022M31.99 12.01l-8.007-8.006M34 8l3.921-3.983M46 13l8.999-8.978M16.968 3.988h7.015M37.921 4.017h17.078M30.36 37.392L37.556 32v26"
        />
      </g>
    </svg>
  );
}

function SecondPlace(props) {
  return (
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path fill="#9b9b9a" d="M28.057 22.427V17h15.858v5.427" />
      <path
        fill="#92d3f5"
        stroke="#92d3f5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.8}
        d="M54.999 4.022L43 16.021h-7l-5.042-5.042 6.963-6.962h17.078"
      />
      <path
        fill="#ea5a47"
        stroke="#ea5a47"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.8}
        d="M23.983 4.004L36 16.02h-7L16.968 3.988h7.015"
      />
      <circle cx={36} cy={44.975} r={23} fill="#9b9b9a" />
      <g fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth={2}>
        <circle cx={36} cy={44.975} r={23} />
        <circle
          cx={36}
          cy={44.975}
          r={23}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M29 19v-2.979M43 19v-2.979M29 16.021h14M25.99 13.01l-9.022-9.022M31.99 12.01l-8.007-8.006M34 8l3.921-3.983M46 13l8.999-8.978M16.968 3.988h7.015M37.921 4.017h17.078M28.322 38.377A7.99 7.99 0 0136.146 32h0c2.205 0 4.202.894 5.647 2.34 2.248 2.248 2.04 5.983-.069 8.362L28.16 58h15.972"
        />
      </g>
    </svg>
  );
}

function ThirdPlace(props) {
  return (
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path fill="#e27022" d="M28.028 22.427V17h15.944v5.427" />
      <circle cx={36} cy={45.021} r={23} fill="#e27022" />
      <path
        fill="#92d3f5"
        stroke="#92d3f5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.8}
        d="M54.999 4.022L43 16.021h-7l-5.042-5.042 6.963-6.962h17.078"
      />
      <path
        fill="#ea5a47"
        stroke="#ea5a47"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.8}
        d="M23.983 4.004L36 16.02h-7L16.968 3.988h7.015"
      />
      <g fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth={2}>
        <circle cx={36} cy={45.021} r={23} />
        <circle
          cx={36}
          cy={45.021}
          r={23}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M29 19v-2.979M43 19v-2.979M29 16.021h14M25.99 13.01l-9.022-9.022M31.99 12.01l-8.007-8.006M34 8l3.921-3.983M46 13l8.999-8.978M16.968 3.988h7.015M37.921 4.017h17.078M28.833 52.81c.684 2.962 3.64 5.19 7.182 5.19h0c4.05 0 7.332-2.91 7.332-6.5S40.065 45 36.015 45c4.05 0 7.332-2.91 7.332-6.5S40.065 32 36.015 32h0c-3.543 0-6.499 2.228-7.182 5.19"
        />
      </g>
    </svg>
  );
}

function PlaceDisplay({ place }) {
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

export const ScoreBoard = injectIntl(() => {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    fetch("/balancer/api/score-board/top")
      .then((response) => response.json())
      .then(({ teams }) => {
        setTeams(teams);
      });

    const timer = setInterval(() => {
      fetch("/balancer/api/score-board/top")
        .then((response) => response.json())
        .then(({ teams }) => {
          setTeams(teams);
        });
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="w-full bg-gray-50 border-none">
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
                <tr className="border-t border-gray-200 bg-gray-50">
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
