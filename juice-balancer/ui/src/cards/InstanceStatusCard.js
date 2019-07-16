import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled from 'styled-components';

import { BodyCard, Button } from '../Components';
import { Spinner } from '../Spinner';

const CenteredText = styled.span`
  text-align: center;
  display: block;
`;

const CenteredCard = styled(BodyCard)`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const InstanceStatusCard = ({ teamname }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    axios
      .get(`/balancer/teams/${teamname}/wait-till-ready`)
      .then(() => {
        setReady(true);
      })
      .catch(() => {
        console.error('Failed to wait for deployment readyness');
      });
  }, [teamname]);

  if (ready) {
    return (
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
    );
  } else {
    return (
      <CenteredCard>
        <Spinner />
        <span>Starting a new Juice Shop Instance</span>
      </CenteredCard>
    );
  }
};
