import React from "react";
import { FormattedMessage } from "react-intl";

import { BodyCard } from "../Components";

const CharDisplay = ({ children, addOffset }) => (
  <span
    className={`font-mono p-3 rounded ${
      addOffset ? "ml-2" : "ml-0"
    } inline-block`}
    style={{ backgroundColor: "var(--background)" }}
  >
    {children}
  </span>
);

const PasscodeDisplayWrapper = ({ children }) => <div>{children}</div>;

const FakePasscodeDisplay = ({ children }) => (
  <span className="hover:hidden">{children}</span>
);

const PasscodeDisplay = ({ children }) => (
  <span className="hidden hover:block">{children}</span>
);

const CenteredContent = ({ children }) => (
  <div className="flex justify-center mt-4">{children}</div>
);

const PasscodeTitle = ({ reset }) => {
  if (reset) {
    return (
      <h2 className="text-2xl font-medium m-0">
        <FormattedMessage id="passcode_reset" defaultMessage="Passcode Reset" />
      </h2>
    );
  } else {
    return (
      <h2 className="text-2xl font-medium m-0">
        <FormattedMessage id="team_created" defaultMessage="Team Created" />
      </h2>
    );
  }
};

export const PasscodeDisplayCard = ({ passcode = "", reset = false }) => {
  return (
    <BodyCard>
      <PasscodeTitle reset={reset} />
      <p>
        <FormattedMessage
          id="passcode_explanation"
          defaultMessage="To make sure not just anyone can join your team, we created a shared passcode for your team. If your teammates want to access the same instance they are required to enter the passcode first. You can copy the passcode from the display below."
        />
      </p>

      <CenteredContent>
        <div>
          <label className="font-light block mb-1">
            <FormattedMessage id="passcode" defaultMessage="Passcode" />
          </label>
          <PasscodeDisplayWrapper aria-label={`Passcode is: ${passcode}`}>
            <FakePasscodeDisplay>
              {"●●●●●●●●".split("").map((char, index) => (
                <CharDisplay
                  addOffset={index === 4}
                  key={index}
                  aria-hidden="true"
                >
                  {char}
                </CharDisplay>
              ))}
            </FakePasscodeDisplay>
            <PasscodeDisplay data-test-id="passcode-display">
              {passcode.split("").map((char, index) => (
                <CharDisplay addOffset={index === 4} key={index}>
                  {char}
                </CharDisplay>
              ))}
            </PasscodeDisplay>
          </PasscodeDisplayWrapper>
        </div>
      </CenteredContent>
    </BodyCard>
  );
};
