import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FormattedMessage } from 'react-intl';
import promiseRetry from 'promise-retry';

import { BodyCard, CenteredCard, Button } from '../Components';
import { Spinner } from '../Spinner';

const CenteredText = styled.span`
  text-align: center;
  display: block;
`;

// Instance is starting up
const waiting = Symbol('WAITING');
// Instance is ready
const ready = Symbol('READY');
// Still waiting, just longer than expected
const waitingForLong = Symbol('WAITING_FOR_LONG');
// Error, instance startup took way to long.
const timedOut = Symbol('TIMED_OUT');

export const InstanceStatusCard = ({ teamname }) => {
  const [instanceStatus, setInstanceStatus] = useState(waiting);

  useEffect(() => {
    promiseRetry(
      (retry, number) => {
        if (number > 1) {
          console.warn('Starting the Instance takes longer than expected.');
          setInstanceStatus(waitingForLong);
        }

        return fetch(`/balancer/teams/${teamname}/wait-till-ready`, {
          method: 'GET',
          timeout: 3 * 60 * 1000,
        })
          .then(response => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response;
          })
          .catch(retry);
      },
      {
        retries: 5,
        factor: 1,
      }
    )
      .then(() => {
        setInstanceStatus(ready);
      })
      .catch(() => {
        console.error('Failed to wait for deployment readiness');
        setInstanceStatus(timedOut);
      });
  }, [teamname]);

  switch (instanceStatus) {
    case waiting:
      return (
        <CenteredCard>
          <Spinner />
          <span data-test-id="instance-status">
            <FormattedMessage
              id="instance_status_starting"
              defaultMessage="Starting a new Juice Shop Instance"
            />
          </span>
        </CenteredCard>
      );
    case ready:
      return (
        <BodyCard>
          <CenteredText>
            <span role="img" aria-label="Done">
              ✅
            </span>{' '}
            <span data-test-id="instance-status">
              <FormattedMessage
                id="instance_status_ready"
                defaultMessage="Juice Shop Instance Ready"
              />
            </span>
          </CenteredText>
          <Button as="a" data-test-id="start-hacking-button" href="/">
            <FormattedMessage id="instance_status_start_hacking" defaultMessage="Start Hacking" />
          </Button>
        </BodyCard>
      );
    case waitingForLong:
      return (
        <CenteredCard>
          <Spinner />
          <span data-test-id="instance-status">
            <FormattedMessage
              id="instance_status_starting_taking_longer_than_usual"
              defaultMessage="Instance starting up is taking longer than usual..."
            />
          </span>
        </CenteredCard>
      );
    default:
      return (
        <CenteredCard>
          <span data-test-id="instance-status">
            <span role="img" aria-label="Error">
              ❌
            </span>{' '}
            <FormattedMessage
              id="instance_status_timed_out"
              defaultMessage="Instance starting timed out!"
            />
          </span>
        </CenteredCard>
      );
  }
};