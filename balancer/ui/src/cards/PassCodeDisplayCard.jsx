import React from "react";
import { FormattedMessage } from "react-intl";

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

export const PasscodeDisplayCard = ({ passcode = "" }) => {
  return (
    <>
      <p className="text-sm mb-2">
        <FormattedMessage
          id="passcode_explanation"
          defaultMessage="You can join the same team using this passcode, on another device or with another teammate."
        />
      </p>
      <div className="flex justify-center">
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
    </>
  );
};
