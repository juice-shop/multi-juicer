import React, { useState } from "react";
import { FormattedMessage } from "react-intl";
import { useNavigate } from "react-router-dom";

import astronaut from "./astronaut.svg";

const LogoutButton = () => {
  const navigate = useNavigate();

  async function logout() {
    try {
      await fetch("/balancer/teams/logout", {
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

const PasscodeResetButton = ({ teamname }) => {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);

  async function resetPasscode() {
    setIsResetting(true);
    try {
      const response = await fetch("/balancer/teams/reset-passcode", {
        method: "POST",
      });
      const data = await response.json();
      navigate(`/teams/${teamname}/joined/`, {
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

export const TeamDisplayCard = ({ teamname }) => {
  return (
    <div className="flex items-center p-4 bg-white shadow-md rounded-md">
      <img src={astronaut} alt="Astronaut" className="h-12 w-auto mr-3" />
      <div className="flex-grow">
        <span className="text-sm text-gray-500 font-light">
          <FormattedMessage id="logged_in_as" defaultMessage="Logged in as" />
        </span>
        <h3 className="text-lg font-medium">{teamname}</h3>
      </div>
      <LogoutButton />
      <PasscodeResetButton teamname={teamname} />
    </div>
  );
};
