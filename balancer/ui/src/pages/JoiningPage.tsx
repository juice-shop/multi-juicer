import { useState } from "react";
import { FormattedMessage } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export const JoiningPage = ({
  setActiveTeam,
}: {
  setActiveTeam: (team: string | null) => void;
}) => {
  const [passcode, setPasscode] = useState("");
  const [failed, setFailed] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const { team } = useParams();

  async function sendJoinRequest() {
    try {
      setFailed(false);
      setIsJoining(true);
      const response = await fetch(`/balancer/api/teams/${team}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });
      setIsJoining(false);

      if (!response.ok) {
        throw new Error("Failed to join the team");
      }

      const data = await response.json();

      setActiveTeam(team!);

      if (data.message === "Signed in as admin") {
        navigate(`/admin`);
        return;
      }
      navigate(`/teams/${team}/status/`);
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
    <div className="max-w-3xl md:min-w-[400px] lg:min-w-[600px]">
      <Card className="p-8 flex flex-col gap-3">
        <h2 className="text-2xl font-medium">
          <FormattedMessage
            id="joining_team"
            defaultMessage="Joining team {team}"
            values={{ team }}
          />
        </h2>

        {failed ? (
          <strong className="text-red-400">
            <FormattedMessage
              id="joining_failed"
              defaultMessage="Failed to join the team. Are you sure the passcode is correct?"
            />
          </strong>
        ) : null}

        <form onSubmit={onSubmit}>
          <input
            type="hidden"
            name="teamname"
            autoComplete="username"
            value={team}
          />
          <label className="font-light block mb-1" htmlFor="passcode">
            <FormattedMessage
              id="team_passcode"
              defaultMessage="Team Passcode"
            />
          </label>
          <input
            className="bg-gray-300 mb-2 border-none rounded-sm p-3 text-sm block w-full text-gray-800 invalid:outline-red-500 invalid:bg-red-100 invalid:outline"
            type="password"
            id="passcode"
            name="passcode"
            data-test-id="passcode-input"
            minLength={8}
            autoComplete="current-password"
            disabled={isJoining}
            value={passcode}
            onChange={({ target }) => setPasscode(target.value)}
          />
          <Button type="submit" disabled={isJoining}>
            <FormattedMessage id="join_team" defaultMessage="Join Team" />
          </Button>
        </form>
      </Card>
    </div>
  );
};
