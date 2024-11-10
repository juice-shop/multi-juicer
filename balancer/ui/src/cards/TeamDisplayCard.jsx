import React, { useState } from "react";
import { FormattedMessage } from "react-intl";
import { useNavigate } from "react-router-dom";

import { Card } from "../Components";

import astronaut from "./astronaut.svg";

export const TeamDisplayCard = ({ teamname }) => {
  return (
    <Card className="flex items-center p-4 bg-white shadow-md rounded-md">
      <img src={astronaut} alt="Astronaut" className="h-12 w-auto mr-3" />
      <div className="flex-grow">
        <span className="text-sm text-gray-500 font-light">
          <FormattedMessage id="logged_in_as" defaultMessage="Logged in as" />
        </span>
        <h3 className="text-lg font-medium">{teamname}</h3>
      </div>
    </Card>
  );
};
