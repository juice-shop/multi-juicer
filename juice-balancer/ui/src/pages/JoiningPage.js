import React, { useState } from 'react';
import axios from 'axios';
import { withRouter } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';

import { BodyCard, H2, Label, Input, Form, Button } from '../Components';

export const JoiningPage = withRouter(({ history, match }) => {
  const [passcode, setPasscode] = useState('');
  const [failed, setFailed] = useState(false);
  const { team } = match.params;

  async function sendJoinRequest() {
    try {
      const res = await axios.post(`/balancer/teams/${team}/join`, {
        passcode,
      });

      if (res.data.message === 'Signed in as admin') {
        history.push(`/admin`);
        return;
      }
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
  }

  return (
    <BodyCard>
      <H2>
        <FormattedMessage
          id="joining_team"
          defaultMessage="Joining team {team}"
          values={{ team }}
        />
      </H2>

      {failed ? (
        <strong>
          <FormattedMessage
            id="joining_failed"
            defaultMessage="Failed to join the team. Are you sure the passcode is correct?"
          />
        </strong>
      ) : null}

      <Form onSubmit={onSubmit}>
        <input type="hidden" name="teamname" autoComplete="username" value={team} />
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
});
