import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FormattedMessage, defineMessages, injectIntl } from "react-intl";
import { Card, Label, Input, Form, Button } from "../Components";
import { InstanceRestartingCard } from "../cards/InstanceRestartingCard";
import { InstanceNotFoundCard } from "../cards/InstanceNotFoundCard";
import { TeamDisplayCard } from "../cards/TeamDisplayCard";

const messages = defineMessages({
  teamnameValidationConstraints: {
    id: "teamname_validation_constraints",
    defaultMessage:
      "Teamnames must have at least 3 characters and consist of lowercase letters, numbers or '-'",
  },
});

const ErrorBox = ({ children }) => (
  <div className="border border-red-500 rounded p-4 bg-red-100 flex flex-col items-center gap-2">
    {children}
  </div>
);

export const JoinPage = injectIntl(({ intl }) => {
  const [teamname, setTeamname] = useState("");
  const [failureMessage, setFailureMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);

  const queryMessage = queryParams.get("msg");
  const queryTeamname = queryParams.get("teamname");
  useEffect(() => {
    if (queryMessage === "instance-not-found") {
      setTeamname(queryTeamname);
    }
  }, [queryMessage, queryTeamname]);

  const passcode = undefined;

  const { formatMessage } = intl;

  async function sendJoinRequest() {
    try {
      const response = await fetch(`/balancer/teams/${teamname}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (
          response.status === 401 &&
          errorData.message === "Team requires authentication to join"
        ) {
          navigate(`/teams/${teamname}/joining/`);
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
      navigate(`/teams/${teamname}/joined/`, {
        state: { passcode: data.passcode },
      });
    } catch (error) {
      setFailureMessage("Unexpected error. Please contact an admin.");
    }
  }

  function onSubmit(event) {
    setIsSubmitting(true);
    event.preventDefault();
    sendJoinRequest({ teamname });
  }

  console.log("render", isSubmitting);

  return (
    <div className="max-w-3xl">
      {queryMessage === "instance-restarting" ? (
        <InstanceRestartingCard teamname={queryTeamname} />
      ) : null}
      {queryMessage === "instance-not-found" ? <InstanceNotFoundCard /> : null}
      {queryMessage === "logged-in" && queryTeamname ? (
        <TeamDisplayCard teamname={queryTeamname} />
      ) : null}

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

        <Form onSubmit={onSubmit}>
          <Label htmlFor="teamname">
            <FormattedMessage id="teamname" defaultMessage="Teamname" />
          </Label>
          <Input
            type="text"
            id="teamname"
            data-test-id="teamname-input"
            name="teamname"
            value={teamname}
            title={formatMessage(messages.teamnameValidationConstraints)}
            pattern="^[a-z0-9]([\-a-z0-9])+[a-z0-9]$"
            maxLength="16"
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
        </Form>
      </Card>
    </div>
  );
});
