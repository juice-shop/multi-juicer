import React, { useState, useEffect } from "react";
import { FormattedMessage } from "react-intl";
import promiseRetry from "promise-retry";

import { BodyCard, CenteredCard, Button } from "../Components";
import { Spinner } from "../Spinner";

// Instance is starting up
const waiting = Symbol("WAITING");
// Instance is ready
const ready = Symbol("READY");
// Still waiting, just longer than expected
const waitingForLong = Symbol("WAITING_FOR_LONG");
// Error, instance startup took way to long.
const timedOut = Symbol("TIMED_OUT");

export const InstanceStatusCard = ({ teamname }) => {
  const [instanceStatus, setInstanceStatus] = useState(waiting);

  useEffect(() => {
    promiseRetry(
      (retry, number) => {
        if (number > 1) {
          console.warn("Starting the Instance takes longer than expected.");
          setInstanceStatus(waitingForLong);
        }

        return fetch(`/balancer/api/teams/${teamname}/wait-till-ready`, {
          method: "GET",
          timeout: 3 * 60 * 1000,
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Network response was not ok");
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
        console.error("Failed to wait for deployment readiness");
        setInstanceStatus(timedOut);
      });
  }, [teamname]);

  switch (instanceStatus) {
    case waiting:
      return (
        <CenteredCard className="flex items-center p-4 bg-white shadow-md rounded-md">
          <Spinner />
          <span data-test-id="instance-status" className="text-gray-700">
            <FormattedMessage
              id="instance_status_starting"
              defaultMessage="Starting a new Juice Shop Instance"
            />
          </span>
        </CenteredCard>
      );
    case ready:
      return (
        <BodyCard className="p-12 bg-white shadow-md rounded-md">
          <span className="block text-center">
            <span role="img" aria-label="Done">
              ✅
            </span>{" "}
            <span data-test-id="instance-status">
              <FormattedMessage
                id="instance_status_ready"
                defaultMessage="Juice Shop Instance Ready"
              />
            </span>
          </span>
          <Button
            as="a"
            data-test-id="start-hacking-button"
            href="/"
            className="mt-4 bg-red-500 text-white py-2 px-4 rounded"
          >
            <FormattedMessage
              id="instance_status_start_hacking"
              defaultMessage="Start Hacking"
            />
          </Button>
        </BodyCard>
      );
    case waitingForLong:
      return (
        <CenteredCard className="flex items-center p-4 bg-white shadow-md rounded-md">
          <Spinner />
          <span data-test-id="instance-status" className="text-gray-700">
            <FormattedMessage
              id="instance_status_starting_taking_longer_than_usual"
              defaultMessage="Instance starting up is taking longer than usual..."
            />
          </span>
        </CenteredCard>
      );
    default:
      return (
        <CenteredCard className="flex items-center p-4 bg-white shadow-md rounded-md">
          <span data-test-id="instance-status" className="text-gray-700">
            <span role="img" aria-label="Error">
              ❌
            </span>{" "}
            <FormattedMessage
              id="instance_status_timed_out"
              defaultMessage="Instance starting timed out!"
            />
          </span>
        </CenteredCard>
      );
  }
};
