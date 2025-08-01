import { useEffect, useState } from "react";
import { FormattedMessage, defineMessages, useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";

import { InstanceNotFoundCard } from "@/cards/InstanceNotFoundCard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

const messages = defineMessages({
  teamnameValidationConstraints: {
    id: "teamname_validation_constraints",
    defaultMessage:
      "Teamnames must have at least 3 characters and consist of lowercase letters, numbers or '-'",
  },
});

const ErrorBox = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-red-500 text-gray-900 mt-2 rounded-sm p-4 bg-red-100 flex flex-col items-center gap-2">
    {children}
  </div>
);

export function JoinPage({
  setActiveTeam,
}: {
  setActiveTeam: (team: string | null) => void;
  activeTeam: string | null;
}) {
  const intl = useIntl();
  const [teamname, setTeamname] = useState("");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);

  const queryMessage = queryParams.get("msg");
  const queryTeamname = queryParams.get("team");
  useEffect(() => {
    if (queryMessage === "instance-not-found" && queryTeamname !== null) {
      setTeamname(queryTeamname);
    }
  }, [queryMessage, queryTeamname]);

  const { formatMessage } = intl;

  async function sendJoinRequest(team: string) {
    try {
      const response = await fetch(`/balancer/api/teams/${team}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (
          response.status === 401 &&
          errorData.message === "Team requires authentication to join"
        ) {
          navigate(`/teams/${team}/joining/`);
        } else if (
          response.status === 500 &&
          errorData.message === "Reached Maximum Instance Count"
        ) {
          setIsSubmitting(false);
          setFailureMessage(
            "Max instances reached, contact admin or join another team to participate."
          );
        } else {
          setIsSubmitting(false);
          setFailureMessage("Unexpected error. Please contact an admin.");
        }
        return;
      }

      const data = await response.json();
      setFailureMessage(null);
      setActiveTeam(team);
      navigate(`/teams/${team}/status/`, {
        state: { passcode: data.passcode },
      });
    } catch {
      setFailureMessage("Unexpected error. Please contact an admin.");
    }
  }

  function onSubmit(event: React.FormEvent) {
    setIsSubmitting(true);
    event.preventDefault();
    sendJoinRequest(teamname);
  }

  return (
    <div className="max-w-3xl">
      {queryMessage === "instance-not-found" ? <InstanceNotFoundCard /> : null}

      <Card className="p-8">
        <h2 className="text-2xl font-medium m-0">
          <FormattedMessage
            id="getting_started"
            defaultMessage="Getting Started"
          />
        </h2>

        <FormattedMessage
          id="getting_started_text"
          defaultMessage={`
              Choose a teamname so that we will be able to recognize you back.
              If you want to team up with other people you can join up under the same teamname.
            `}
          values={{
            strong: (msg) => <strong>{msg}</strong>,
          }}
        />

        {failureMessage !== null ? (
          <ErrorBox>
            <strong>
              <FormattedMessage
                id="join_failed_text"
                defaultMessage="Failed To Create / Join the Team"
              />
            </strong>
            <p>{failureMessage}</p>
          </ErrorBox>
        ) : null}

        <form className="mt-4" onSubmit={onSubmit}>
          <label className="font-light block mb-1" htmlFor="teamname">
            <FormattedMessage id="teamname" defaultMessage="Teamname" />
          </label>
          <input
            className="bg-gray-300 mb-2 border-none rounded-sm p-3 text-sm block w-full text-gray-800 invalid:outline invalid:outline-red-500 invalid:bg-red-100"
            type="text"
            id="teamname"
            data-test-id="teamname-input"
            name="teamname"
            value={teamname}
            title={formatMessage(messages.teamnameValidationConstraints)}
            pattern="^[a-z0-9]([\-a-z0-9])+[a-z0-9]$"
            maxLength={16}
            onChange={({ target }) => setTeamname(target.value)}
          />
          <Button
            data-test-id="create-join-team-button"
            type="submit"
            disabled={isSubmitting}
          >
            <FormattedMessage
              id="create_or_join_team_label"
              defaultMessage="Create / Join Team"
            />
          </Button>
        </form>
      </Card>
    </div>
  );
}
