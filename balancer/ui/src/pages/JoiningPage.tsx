import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormattedMessage } from "react-intl";

import { Card } from "../Components";
import { Button } from "../components/Button";

export const JoiningPage = () => {
  const [passcode, setPasscode] = useState("");
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const { team } = useParams();

  async function sendJoinRequest() {
    try {
      const response = await fetch(`/balancer/api/teams/${team}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });

      if (!response.ok) {
        throw new Error("Failed to join the team");
      }

      const data = await response.json();

      if (data.message === "Signed in as admin") {
        navigate(`/admin`);
        return;
      }
      navigate(`/teams/${team}/joined/`);
    } catch (error) {
      console.error("Unknown error while trying to join a team!");
      console.error(error);
      setFailed(true);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    sendJoinRequest();
  }

  return (
    <Card>
      <h2 className="text-2xl font-medium m-0">
        <FormattedMessage
          id="joining_team"
          defaultMessage="Joining team {team}"
          values={{ team }}
        />
      </h2>

      {failed ? (
        <strong>
          <FormattedMessage
            id="joining_failed"
            defaultMessage="Failed to join the team. Are you sure the passcode is correct?"
          />
        </strong>
      ) : null}

      <form className="mt-8" onSubmit={onSubmit}>
        <input
          type="hidden"
          name="teamname"
          autoComplete="username"
          value={team}
        />
        <label className="font-light block mb-1" htmlFor="passcode">
          <FormattedMessage id="team_passcode" defaultMessage="Team Passcode" />
        </label>
        <input
          className="bg-gray-300 border-none rounded p-3 text-sm block w-full text-gray-800 invalid:outline-red-500 invalid:bg-red-100 outline"
          type="password"
          id="passcode"
          name="passcode"
          data-test-id="passcode-input"
          minLength={8}
          maxLength={8}
          autoComplete="current-password"
          value={passcode}
          onChange={({ target }) => setPasscode(target.value)}
        />
        <Button data-test-id="join-team-button" type="submit">
          <FormattedMessage id="join_team" defaultMessage="Join Team" />
        </Button>
      </form>
    </Card>
  );
};
