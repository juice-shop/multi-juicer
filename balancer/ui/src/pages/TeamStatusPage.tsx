import { FormattedMessage } from "react-intl";
import { Link, useLocation, useParams } from "react-router-dom";

import { PasscodeDisplayCard } from "@/cards/PassCodeDisplayCard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PositionDisplay } from "@/components/PositionDisplay";
import { useTeamStatus, type TeamStatus } from "@/hooks/useTeamStatus";

export const TeamStatusPage = ({
  setActiveTeam,
}: {
  setActiveTeam: (team: string | null) => void;
}) => {
  const { team } = useParams();
  const { state } = useLocation();
  const passcode: string | null = state?.passcode || null;

  const { data: instanceStatus } = useTeamStatus("me", {
    onTeamUpdate: setActiveTeam,
  });

  if (!team) {
    return <div>Team not found</div>;
  }

  return (
    <>
      <link rel="preload" href="/balancer/icons/first-place.svg" as="image" />
      <link rel="preload" href="/balancer/icons/second-place.svg" as="image" />
      <link rel="preload" href="/balancer/icons/third-place.svg" as="image" />

      <Card className="w-full max-w-2xl">
        <div className="flex flex-row items-center p-4">
          <img
            src="/balancer/icons/astronaut.svg"
            alt="Astronaut"
            className="h-12 w-12 shrink-0 mr-3"
          />

          <div className="text-sm font-light">
            <p>
              <FormattedMessage
                id="logged_in_as"
                defaultMessage="Logged in as"
              />
            </p>
            <p>
              <strong className="font-medium">{team}</strong>
            </p>
          </div>
        </div>

        <hr className="border-gray-500" />

        <ScoreDisplay instanceStatus={instanceStatus} />
        <hr className="border-gray-500" />

        {passcode && (
          <>
            <div className="flex flex-col justify-start p-4">
              <PasscodeDisplayCard passcode={passcode} />
            </div>
            <hr className="border-gray-500" />
          </>
        )}

        <StatusDisplay instanceStatus={instanceStatus} />
      </Card>
    </>
  );
};

function ScoreDisplay({
  instanceStatus,
}: {
  instanceStatus: TeamStatus | null;
}) {
  if (!instanceStatus?.position || instanceStatus?.position === -1) {
    return (
      <div className="p-4 text-sm">
        <FormattedMessage
          id="updating_score"
          defaultMessage="Your score is getting calculated..."
        />
      </div>
    );
  }
  return (
    <div className="grid md:grid-cols-[auto_max-content] grid-cols-1 items-center">
      <div className="flex flex-row items-center p-4">
        <div className="h-12 w-12 mr-3 flex shrink-0 items-center justify-center">
          <PositionDisplay place={instanceStatus?.position || -1} />
        </div>
        <span className="text-sm font-light">
          <FormattedMessage
            id="team_score"
            defaultMessage="You're in the {position}/{totalTeams} place with {solvedChallengeCount} solved challenges"
            values={{
              position: instanceStatus?.position,
              totalTeams: instanceStatus?.totalTeams,
              solvedChallengeCount: instanceStatus?.solvedChallenges.length,
            }}
          />
        </span>
      </div>
      <div className="flex flex-row-reverse items-center p-4">
        <Link
          to="/score-overview"
          className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-sm"
        >
          <FormattedMessage
            id="score_overview"
            defaultMessage="Score Overview"
          />{" "}
          →
        </Link>
      </div>
    </div>
  );
}

function StatusDisplay({
  instanceStatus,
}: {
  instanceStatus: TeamStatus | null;
}) {
  if (!instanceStatus?.readiness) {
    return (
      <div className="p-6">
        <Button disabled>
          <FormattedMessage
            id="instance_status_starting"
            defaultMessage="JuiceShop instance is starting..."
          />
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Button as="a" href="/" target="_blank">
        <FormattedMessage
          id="instance_status_start_hacking"
          defaultMessage="Start Hacking!"
        />
      </Button>
    </div>
  );
}
