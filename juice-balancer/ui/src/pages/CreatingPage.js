import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withRouter } from 'react-router-dom';

import styled from 'styled-components';

import { Spinner } from '../Spinner';

import { Layout } from '../Layout';
import { BodyCard, H2, Label, Button } from '../Components';

function PasscodeDisplay({ passcode = '' }) {
  return (
    <CenteredContent>
      <div>
        <Label>Passcode</Label>
        {passcode.split('').map((char, index) => {
          return <CharDisplay offset={index === 4}>{char}</CharDisplay>;
        })}
      </div>
    </CenteredContent>
  );
}

const CenteredText = styled.span`
  text-align: center;
  display: block;
`;

const CenteredCard = styled(BodyCard)`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const CharDisplay = styled.span`
  font-family: monospace;
  padding: 12px 8px;
  background-color: #d8d8d8;
  border-radius: 4px;
  margin-right: 8px;
  margin-left: ${props => (props.offset ? '8px' : '0')};
  display: inline-block;
`;

const CenteredContent = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
`;

export const CreatingPage = withRouter(({ location, match }) => {
  const { passcode } = location.state;
  const { team } = match.params;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    axios
      .get(`/balancer/teams/${team}/wait-till-ready`)
      .then(() => {
        setReady(true);
      })
      .catch(() => {
        console.error('Failed to wait for deployment readyness');
      });
  }, [team]);

  return (
    <Layout>
      <>
        <BodyCard>
          <H2>Team Created</H2>
          <p>
            To make sure not anyone can just join your team, we created a{' '}
            <strong>shared passcode</strong> for your team. If your teammates
            want to access the same instance they are required to enter the
            passcode first. You can <strong>copy the passcode</strong> from the
            display below.
          </p>

          <PasscodeDisplay passcode={passcode} />
        </BodyCard>

        {ready ? (
          <BodyCard>
            <CenteredText>
              <span role="img" aria-label="Done">
                ✅
              </span>{' '}
              Juice Shop Instance ready
            </CenteredText>
            <Button
              onClick={() => {
                window.location = '/';
              }}
            >
              Start Hacking
            </Button>
          </BodyCard>
        ) : (
          <CenteredCard>
            <Spinner />
            <span>Starting a new Juice Shop Instance</span>
          </CenteredCard>
        )}
      </>
    </Layout>
  );
});
