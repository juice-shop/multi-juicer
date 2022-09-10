import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { FormattedMessage, defineMessages, injectIntl } from 'react-intl';

import styled, { createGlobalStyle } from 'styled-components';

import { BodyCard, H2, Label, Input, Form, Button } from '../Components';
import { InstanceRestartingCard } from '../cards/InstanceRestartingCard';
import { InstanceNotFoundCard } from '../cards/InstanceNotFoundCard';
import { TeamDisplayCard } from '../cards/TeamDisplayCard';

const messages = defineMessages({
  teamnameValidationConstraints: {
    id: 'teamname_validation_constraints',
    defaultMessage: "Teamnames must consist of lowercase letter, number or '-'",
  },
});

export const JoinPage = injectIntl(({ intl }) => {
  const [teamname, setTeamname] = useState('');
  const [failed, setFailed] = useState(false);
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

      navigate(`/teams/${teamname}/joined/`, { state: { passcode: data.passcode }});
    } catch (error) {
      if (
        error.response.status === 401 &&
        error.response.data.message === 'Team requires authentication to join'
      ) {
        navigate(`/teams/${teamname}/joining/`);
      } else {
        setFailed(true);
      }
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendJoinRequest({ teamname });
  }

  const CenterLogo = styled.img`
  display: block;
  margin-left: auto;
  margin-right: auto;
  width: 50%;
`;

CenterLogo.defaultProps = {
  src: process.env.REACT_APP_MOVING_GIF_LOGO,
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
        <CenterLogo/>
        <H2>
          <FormattedMessage id="welcome_title" defaultMessage="Welcome!" />
        </H2>
        <FormattedMessage id="welcome_text" defaultMessage={`
          Welcome to the WrongSecrets CTF Party! This CTF uses 3 domains:
        `}
        values={{
          strong: (msg) => <strong>{msg}</strong>,
        }}/>
        <ul> 
          <li>This domain: here is where you can do your exercises</li>
          <li>The domain where you provide your responses in exchange for a CTF key: URLHERE1</li>
          <li>The domain where you provide your CTF key: URLHERE2</li>
          <li>Optionally: the storage bucket with Terraform state for the cloud challneges: URLHERE3</li>
        </ul>
        <FormattedMessage id="welcome_text_2" defaultMessage={`
          We need multiple domains, as you will be able to steal the CTF key after a few challenges.
        `}
        values={{
          strong: (msg) => <strong>{msg}</strong>,
        }}/>

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

        {failed ? (
          <p>
            <strong>
              <FormattedMessage
                id="join_failed_text"
                defaultMessage="Failed to create / join the team"
              />
            </strong>
          </p>
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
            pattern="^[a-z0-9]([-a-z0-9])+[a-z0-9]$"
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
