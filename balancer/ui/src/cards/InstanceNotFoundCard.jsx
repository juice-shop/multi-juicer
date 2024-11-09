import React from "react";
import { FormattedMessage } from "react-intl";

import { Card } from "../Components";

import warning from "./warning.svg";

export const InstanceNotFoundCard = () => {
  return (
    <Card className="flex items-center p-4 bg-white shadow-md rounded-md">
      <img src={warning} alt="Warning" className="h-12 w-auto mr-3" />
      <span data-test-id="instance-not-found" className="text-gray-700">
        <FormattedMessage
          id="instance_status_not_found"
          defaultMessage="Could not find the instance for the team. You can recreate it by logging back in."
        />
      </span>
    </Card>
  );
};
