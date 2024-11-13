import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../Components";
import { FormattedMessage } from "react-intl";
import { PositionDisplay } from "./ScoreBoard";
import { PasscodeDisplayCard } from "../cards/PasscodeDisplayCard";

interface TeamStatusResponse {
  name: string;
  score: string;
  position: number;
  totalTeams: number;
  solvedChallenges: number;
  readiness: boolean;
}

const LogoutButton = () => {
  const navigate = useNavigate();

  async function logout() {
    try {
      await fetch("/balancer/api/teams/logout", {
        method: "POST",
      });
      navigate("/");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

  return (
    <button
      onClick={logout}
      className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
    >
      <FormattedMessage id="log_out" defaultMessage="Log Out" />
    </button>
  );
};

const PasscodeResetButton = ({ team }: { team: string }) => {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);

  async function resetPasscode() {
    setIsResetting(true);
    try {
      const response = await fetch("/balancer/api/teams/reset-passcode", {
        method: "POST",
      });
      const data = await response.json();
      navigate(`/teams/${team}/joined/`, {
        state: { passcode: data.passcode, reset: true },
      });
    } catch (error) {
      console.error("Failed to reset passcode", error);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <button
      onClick={resetPasscode}
      disabled={isResetting}
      className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
    >
      <FormattedMessage id="reset_passcode" defaultMessage="Reset Passcode" />
    </button>
  );
};

async function fetchTeamStatusData(): Promise<TeamStatusResponse> {
  const response = await fetch(`/balancer/api/teams/status`);
  if (!response.ok) {
    throw new Error("Failed to fetch current teams");
  }
  const status = (await response.json()) as TeamStatusResponse;
  return status;
}

export const TeamStatusPage = () => {
  const { team } = useParams();

  const [instanceStatus, setInstanceStatus] =
    useState<TeamStatusResponse | null>(null);

  async function updateStatusData() {
    try {
      const status = await fetchTeamStatusData();
      setInstanceStatus(status);
    } catch (err) {
      console.error("Failed to fetch current teams!", err);
    }
  }

  useEffect(() => {
    updateStatusData();

    const interval = setInterval(updateStatusData, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [team]);

  if (!team) {
    return <div>Team not found</div>;
  }

  return (
    <Card className="w-full max-w-2xl">
      <div className="grid grid-cols-2 items-center">
        <div className="flex flex-row items-center p-4">
          <img
            src="/balancer/icons/astronaut.svg"
            alt="Astronaut"
            className="h-12 w-auto mr-3"
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
        <div className="flex flex-row-reverse items-center p-4 gap-3">
          <LogoutButton />
          <PasscodeResetButton team={team} />
        </div>
      </div>

      <hr className="border-gray-500" />

      <div className="grid grid-cols-2 items-center">
        <div className="flex flex-row items-center p-4">
          <div className="h-12 w-auto mr-3 flex items-center">
            <PositionDisplay place={instanceStatus?.position || -1} />
          </div>

          <span className="text-sm font-light ml-2">
            <FormattedMessage
              id="joining_team"
              defaultMessage="You're in the {position}/{totalTeams} place with {solvedChallengeCount} solved challenges"
              values={{
                position: instanceStatus?.position,
                totalTeams: instanceStatus?.totalTeams,
                solvedChallengeCount: instanceStatus?.solvedChallenges,
              }}
            />
          </span>
        </div>
        <div className="flex flex-row-reverse items-center p-4">
          <a
            href="/balancer/score-board"
            className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
          >
            Score Overview →
          </a>
        </div>
      </div>
      <hr className="border-gray-500" />
      <div className="flex flex-col justify-start p-4">
        <PasscodeDisplayCard passcode="12345678" />
      </div>

      <li>team: {instanceStatus?.name}</li>
      <li>readiness: {instanceStatus?.readiness ? "ready" : "down"}</li>
      <li>score: {instanceStatus?.score}</li>
      <li>position: {instanceStatus?.position}</li>
    </Card>
  );
};