import React, { useState } from 'react';
import axios from 'axios';
import { withRouter } from 'react-router-dom';

import { Layout } from '../Layout';
import { BodyCard, H2, Label, Input, Form, Button } from '../Components';

export const JoinPage = withRouter(({ history }) => {
  const [teamname, setTeamname] = useState('');
  const [failed, setFailed] = useState(false);
  const passcode = undefined;

  async function sendJoinRequest() {
    try {
      const { data } = await axios.post(`/balancer/teams/${teamname}/join`, {
        passcode,
      });

      console.log('got data back');
      console.log(data);

      history.push(`/teams/${teamname}/joined/`, { passcode: data.passcode });
    } catch (error) {
      if (
        error.response.status === 401 &&
        error.response.data.message === 'Team requires authentication to join'
      ) {
        history.push(`/teams/${teamname}/joining/`);
      } else {
        console.error('Unkown error while trying to join a team!');
        console.error(error);
        setFailed(true);
      }
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendJoinRequest({ teamname });
  }

  return (
    <Layout>
      <BodyCard>
        <H2>Getting Started</H2>
        <p>
          Chose a <strong>teamname</strong> so that we will be able to recognise you back.
        </p>
        <p>
          If you want to <strong>team up</strong> with other people you can join up under the same
          teamname.
        </p>

        {failed ? <strong>Failed to join the team</strong> : null}

        <Form onSubmit={onSubmit}>
          <Label htmlFor="teamname">Teamname</Label>
          <Input
            type="text"
            id="teamname"
            name="teamname"
            value={teamname}
            title="Teamnames must consist of lowercase letter, number or '-'"
            pattern="^[a-z0-9]([-a-z0-9])+[a-z0-9]$"
            maxLength="16"
            onChange={({ target }) => setTeamname(target.value)}
          />
          <Button type="submit">Create / Join Team</Button>
        </Form>
      </BodyCard>
    </Layout>
  );
});
