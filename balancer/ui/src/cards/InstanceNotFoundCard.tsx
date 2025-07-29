import { Card } from "../components/Card";
import { FormattedMessage } from "react-intl";

export const InstanceNotFoundCard = () => {
  return (
    <Card className="flex items-center p-4 bg-white shadow-md rounded-md mb-3">
      <img
        src="/balancer/icons/warning.svg"
        alt="Warning"
        className="h-12 w-auto mr-3"
      />
      <span data-test-id="instance-not-found">
        <FormattedMessage
          id="instance_status_not_found"
          defaultMessage="Could not find the instance for the team. You can recreate it by logging back in."
        />
      </span>
    </Card>
  );
};
