import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { FormattedMessage, defineMessages, injectIntl } from 'react-intl';
import cryptoJS from 'crypto-js';

import styled from 'styled-components';

import { BodyCard, H2, Label, Input, Form, Button } from '../Components';
import { InstanceRestartingCard } from '../cards/InstanceRestartingCard';
import { InstanceNotFoundCard } from '../cards/InstanceNotFoundCard';
import { TeamDisplayCard } from '../cards/TeamDisplayCard';

const messages = defineMessages({
  teamnameValidationConstraints: {
    id: 'teamname_validation_constraints',
    defaultMessage: "Teamnames must consist of lowercase letter, number or '-'",
  },
  passwordValidationConstraints: {
    id: 'password_validation_constraints',
    defaultMessage: 'Passwords must consist of alphanumeric characters only',
  },
});

const CenterLogo = styled.img`
  display: block;
  margin-left: auto;
  margin-right: auto;
  width: 75%;
`;

export const JoinPage = injectIntl(({ intl }) => {
  const [teamname, setTeamname] = useState('');
  const [password, setPassword] = useState('');
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
      if (!teamname || teamname.length === 0) {
        setFailed(true);
        return;
      }
      if (dynamics.enable_password) {
        const hmacvalue = cryptoJS
          .HmacSHA256(`${teamname}`, 'hardcodedkey')
          .toString(cryptoJS.enc.Hex);
        const { data } = await axios.post(`/balancer/teams/${teamname}/join`, {
          passcode,
          hmacvalue,
          password,
        });
        navigate(`/teams/${teamname}/joined/`, { state: { passcode: data.passcode } });
      } else {
        const hmacvalue = cryptoJS
          .HmacSHA256(`${teamname}`, 'hardcodedkey')
          .toString(cryptoJS.enc.Hex);
        const { data } = await axios.post(`/balancer/teams/${teamname}/join`, {
          passcode,
          hmacvalue,
        });
        navigate(`/teams/${teamname}/joined/`, { state: { passcode: data.passcode } });
      }
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

  const initialDynamics = {
    // type all the fields you need
    react_gif_logo: 'https://i.gifer.com/9kGQ.gif',
    heroku_wrongsecret_ctf_url: process.env['REACT_APP_HEROKU_WRONGSECRETS_URL'],
    ctfd_url: process.env['REACT_APP_CTFD_URL'],
    s3_bucket_url: process.env['REACT_APP_S3_BUCKET_URL'],
    enable_password: false,
  };

  const [dynamics, setDynamics] = useState(initialDynamics);
  useEffect(() => {
    axios
      .get('/balancer/dynamics')
      .then((response) => {
        setDynamics(response.data);
      })
      .catch((err) => {
        console.error(`Failed to wait parse values: ${err}`);
      });
  }, []);

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
        <CenterLogo src={dynamics.react_gif_logo} />
        <H2>
          <FormattedMessage id="welcome_title" defaultMessage="Welcome!" />
        </H2>
        <FormattedMessage
          id="welcome_text"
          defaultMessage={`
          Welcome to the WrongSecrets CTF Party! This CTF uses 2 domains:
        `}
          values={{
            strong: (msg) => <strong>{msg}</strong>,
          }}
        />
        <ul>
          <li>This domain: here is where you can do your exercises</li>
          <li>
            The domain where you provide your answer found in exchange for points:{' '}
            <a style={{ color: 'white' }} href={dynamics.ctfd_url}>
              {dynamics.ctfd_url}
            </a>
          </li>
          <li>
            Optionally: the storage bucket with Terraform state for the cloud challneges:{' '}
            <a style={{ color: 'white' }} href={dynamics.s3_bucket_url}>
              {dynamics.s3_bucket_url}
            </a>
            . For this you will need credentials that will be provided to you as part of the CTF
            instructions.
          </li>
        </ul>
        <FormattedMessage
          id="welcome_text_2"
          defaultMessage={`
          We need to usse multiple domains, as you will be able to steal the CTF key after a few challenges.
        `}
          values={{
            strong: (msg) => <strong>{msg}</strong>,
          }}
        />
        <br />
        <br />

        <H2>
          <FormattedMessage id="getting_started" defaultMessage="Getting Started" />
        </H2>

        <FormattedMessage
          id="getting_started_text"
          defaultMessage={`
              Choose a teamname so that we will be able to recognize you back.
              Please make sure to use the same teamname here as you do in CTFD, as your team might otherwise get deleted.
              If you want to team up with other people you can join up under the same teamname.
            `}
          values={{
            strong: (msg) => <strong>{msg}</strong>,
          }}
        />

        {dynamics.enable_password ? (
          <p>
            <FormattedMessage
              id="getting_started_password"
              defaultMessage={`
              In the password field you have to enter the password you received as part of your CTF instructions.
              This can be different from the CTFD passswords.
            `}
              values={{
                strong: (msg) => <strong>{msg}</strong>,
              }}
            />
          </p>
        ) : null}
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
          {dynamics.enable_password ? (
            <p>
              <Label htmlFor="password">
                <FormattedMessage id="password" defaultMessage="Password" />
              </Label>
              <Input
                type="password"
                id="password"
                data-test-id="password-input"
                name="password"
                disabled={!dynamics.enable_password}
                value={password}
                title={formatMessage(messages.passwordValidationConstraints)}
                pattern="^[a-zA-Z0-9]([-a-z-A-Z0-9])+[a-zA-Z0-9]$"
                maxLength="64"
                onChange={({ target }) => setPassword(target.value)}
              />
            </p>
          ) : null}
          <Button data-test-id="create-join-team-button" type="submit">
            <FormattedMessage id="create_or_join_team_label" defaultMessage="Create / Join Team" />
          </Button>
        </Form>
      </BodyCard>
    </>
  );
});
