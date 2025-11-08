import { useState } from "react";
import toast from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";

import { classNames } from "@/util/classNames";

export const PasscodeDisplayCard = ({ passcode = "" }) => {
  const intl = useIntl();
  const placeHolder = passcode.replace(/./g, "●");
  const [activlyDisplayedPasscode, setActivlyDisplayedPasscode] =
    useState<string>(placeHolder);

  return (
    <>
      <p className="text-sm mb-2">
        <FormattedMessage
          id="passcode_explanation"
          defaultMessage="Use this passcode to join the same team on another device or with a teammate."
        />
      </p>
      <div
        className="flex justify-center cursor-copy"
        aria-label={`Passcode is: ${passcode}`}
        onMouseEnter={() => setActivlyDisplayedPasscode(passcode)}
        onMouseLeave={() => setActivlyDisplayedPasscode(placeHolder)}
        title="Click to copy"
        onClick={() => {
          navigator.clipboard.writeText(passcode);
          toast.success(
            intl.formatMessage({
              id: "passcode_copied",
              defaultMessage: "Passcode copied to clipboard",
            })
          );
        }}
      >
        <div className="flex gap-1">
          {activlyDisplayedPasscode.split("").map((char, index) => (
            <span
              key={index}
              className={classNames(
                "font-mono p-3 rounded-sm inline-block dark:bg-gray-900 bg-gray-200",
                (index + 1) % 4 === 0 ? "mr-3" : ""
              )}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    </>
  );
};
