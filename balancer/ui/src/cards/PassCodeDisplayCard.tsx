import { useState } from "react";
import toast from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";
import { useParams } from "react-router-dom";

export const PasscodeDisplayCard = ({ passcode = "" }) => {
  const intl = useIntl();
  const { team } = useParams();
  const placeHolder = passcode.replace(/./g, "●");
  const [activlyDisplayedPasscode, setActivlyDisplayedPasscode] =
    useState<string>(placeHolder);

  const joinLink = `${window.location.origin}/balancer/teams/${team}/joining#${passcode}`;

  const copyJoinLink = () => {
    if (!navigator.clipboard) {
      toast.error(
        intl.formatMessage({
          id: "clipboard_not_available",
          defaultMessage:
            "Clipboard access is not available. Please copy the link manually.",
        })
      );
      return;
    }
    navigator.clipboard.writeText(joinLink);
    toast.success(
      intl.formatMessage({
        id: "join_link_copied",
        defaultMessage: "Join link copied to clipboard",
      })
    );
  };

  return (
    <>
      <p className="text-sm mb-4">
        <FormattedMessage
          id="passcode_explanation"
          defaultMessage="Share the join link or passcode with your teammates to join this team."
        />
      </p>

      {/* Join Link Section */}
      <div className="mb-4 flex justify-center">
        <button
          onClick={copyJoinLink}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-6 rounded-sm transition-colors flex items-center gap-2"
          title={intl.formatMessage({
            id: "copy_join_link",
            defaultMessage: "Copy join link",
          })}
        >
          <img src="/balancer/icons/link.svg" alt="" className="h-5 w-5" />
          <span>
            <FormattedMessage
              id="copy_link_button"
              defaultMessage="Copy Join Link"
            />
          </span>
        </button>
      </div>

      {/* Passcode Section */}
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          <FormattedMessage
            id="passcode_label"
            defaultMessage="Or use the same teamname and the following passcode"
          />
        </p>
        <div
          className="flex justify-center cursor-copy"
          aria-label={`Passcode is: ${passcode}`}
          onMouseEnter={() => setActivlyDisplayedPasscode(passcode)}
          onMouseLeave={() => setActivlyDisplayedPasscode(placeHolder)}
          title="Click to copy"
          onClick={() => {
            if (!navigator.clipboard) {
              toast.error(
                intl.formatMessage({
                  id: "clipboard_not_available",
                  defaultMessage:
                    "Clipboard access is not available. Please copy the passcode manually.",
                })
              );
              return;
            }
            navigator.clipboard.writeText(passcode);
            toast.success(
              intl.formatMessage({
                id: "passcode_copied",
                defaultMessage: "Passcode copied to clipboard",
              })
            );
          }}
        >
          <div className="flex gap-3 flex-wrap">
            {activlyDisplayedPasscode.match(/.{1,4}/g)!.map((group, index) => (
              <span className="flex gap-1" key={"group-" + index}>
                {group.split("").map((char, index) => (
                  <span
                    key={"char-" + index}
                    className={
                      "font-mono p-3 rounded-sm inline-block dark:bg-gray-900 bg-gray-200"
                    }
                  >
                    {char}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
