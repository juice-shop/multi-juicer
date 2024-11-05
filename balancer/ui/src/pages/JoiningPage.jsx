import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormattedMessage } from "react-intl";

import { BodyCard, Label, Input, Form, Button } from "../Components";

export const JoiningPage = () => {
  const [passcode, setPasscode] = useState("");
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const { team } = useParams();

  async function sendJoinRequest() {
    try {
      const response = await fetch(`/balancer/teams/${team}/join`, {
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

  function onSubmit(event) {
    event.preventDefault();
    sendJoinRequest();
  }

  return (
    <BodyCard>
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

      <Form onSubmit={onSubmit}>
        <input
          type="hidden"
          name="teamname"
          autoComplete="username"
          value={team}
        />
        <Label htmlFor="passcode">
          <FormattedMessage id="team_passcode" defaultMessage="Team Passcode" />
        </Label>
        <Input
          type="password"
          id="passcode"
          name="passcode"
          data-test-id="passcode-input"
          minLength="8"
          maxLength="8"
          autoComplete="current-password"
          value={passcode}
          onChange={({ target }) => setPasscode(target.value)}
        />
        <Button data-test-id="join-team-button" type="submit">
          <FormattedMessage id="join_team" defaultMessage="Join Team" />
        </Button>
      </Form>
    </BodyCard>
  );
};
