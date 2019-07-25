import React, { useState } from 'react';
import axios from 'axios';
import { withRouter } from 'react-router-dom';

import { Layout } from '../Layout';
import { BodyCard, H2, Label, Input, Form, Button } from '../Components';

export const JoiningPage = withRouter(({ history, match }) => {
  const [passcode, setPasscode] = useState('');
  const [failed, setFailed] = useState(false);
  const { team } = match.params;

  async function sendJoinRequest() {
    try {
      await axios.post(`/balancer/teams/${team}/join`, {
        passcode,
      });

      history.push(`/teams/${team}/joined/`);
    } catch (error) {
      console.error('Unkown error while trying to join a team!');
      console.error(error);
      setFailed(true);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendJoinRequest();
    console.log('join team...');
  }

  return (
    <Layout>
      <BodyCard>
        <H2>Joining Team {team}</H2>

        {failed ? (
          <strong>Failed to join the team. Are you sure the passcode is correct?</strong>
        ) : null}

        <Form onSubmit={onSubmit}>
          <Label htmlFor="passcode">Team Passcode</Label>
          <Input
            type="password"
            id="passcode"
            name="passcode"
            data-test-id="passcode-input"
            minLength="8"
            maxLength="8"
            value={passcode}
            onChange={({ target }) => setPasscode(target.value)}
          />
          <Button data-test-id="join-team-button" type="submit">
            Join Team
          </Button>
        </Form>
      </BodyCard>
    </Layout>
  );
});
