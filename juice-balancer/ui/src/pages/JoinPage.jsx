import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { FormattedMessage, defineMessages, injectIntl } from 'react-intl';

import { BodyCard, H2, Label, Input, Form, Button } from '../Components';
import { InstanceRestartingCard } from '../cards/InstanceRestartingCard';
import { InstanceNotFoundCard } from '../cards/InstanceNotFoundCard';
import { TeamDisplayCard } from '../cards/TeamDisplayCard';
import styled from 'styled-components';

const messages = defineMessages({
  teamnameValidationConstraints: {
    id: 'teamname_validation_constraints',
    defaultMessage:
      "Teamnames must have at least 3 characters and consist of lowercase letters, numbers or '-'",
  },
});

const ErrorBox = styled.div`
  border: 1px solid red;
  border-radius: 4px;
  margin: 1rem 0;
  padding: 0.5rem;
  background-color: rgba(255, 0, 0, 0.1);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;

  p {
    margin: 0;
  }
`;

export const JoinPage = injectIntl(({ intl }) => {
  const [teamname, setTeamname] = useState('');
  const [failureMessage, setFailureMessage] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);

  const queryMessage = queryParams.get('msg');
  const queryTeamname = queryParams.get('teamname');
  useEffect(() => {
    if (queryMessage === 'instance-not-found') {
      setTeamname(queryTeamname);
    }
  }, [queryMessage, queryTeamname]);

  const passcode = undefined;

  const { formatMessage } = intl;

  async function sendJoinRequest() {
    try {
      const { data } = await axios.post(`/balancer/teams/${teamname}/join`, {
        passcode,
      });

      setFailureMessage(null);
      navigate(`/teams/${teamname}/joined/`, { state: { passcode: data.passcode } });
    } catch (error) {
      if (
        error.response.status === 401 &&
        error.response.data.message === 'Team requires authentication to join'
      ) {
        navigate(`/teams/${teamname}/joining/`);
      } else if (
        error.response.status === 500 &&
        error.response.data.message === 'Reached Maximum Instance Count'
      ) {
        setFailureMessage(
          'Max instances reached, contact admin or join another team to participate.'
        );
      } else {
        setFailureMessage('Unexpected error. Please contact an admin.');
      }
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendJoinRequest({ teamname });
  }

  return (
    <>
      {queryMessage === 'instance-restarting' ? (
        <InstanceRestartingCard teamname={queryTeamname} />
      ) : null}
      {queryMessage === 'instance-not-found' ? <InstanceNotFoundCard /> : null}
      {queryMessage === 'logged-in' && queryTeamname ? (
        <TeamDisplayCard teamname={queryTeamname} />
      ) : null}

      <BodyCard>
        <H2>
          <FormattedMessage id="getting_started" defaultMessage="Getting Started" />
        </H2>

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
          <Button data-test-id="create-join-team-button" type="submit">
            <FormattedMessage id="create_or_join_team_label" defaultMessage="Create / Join Team" />
          </Button>
        </Form>
      </BodyCard>
    </>
  );
});
