import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled from 'styled-components';

import { BodyCard, Button } from '../Components';
import { Spinner } from '../Spinner';

const LinkButton = Button.withComponent('a');

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
      .get(`/balancer/teams/${teamname}/wait-till-ready`, {
        // Wait at most 3 minutes before timing out
        timeout: 3 * 60 * 1000,
      })
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
          <span data-test-id="instance-status">Juice Shop Instance ready</span>
        </CenteredText>
        <LinkButton data-test-id="start-hacking-button" href="/">
          Start Hacking
        </LinkButton>
      </BodyCard>
    );
  } else {
    return (
      <CenteredCard>
        <Spinner />
        <span data-test-id="instance-status">Starting a new Juice Shop Instance</span>
      </CenteredCard>
    );
  }
};
