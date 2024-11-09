import Popup from "reactjs-popup";
import { FormattedMessage } from "react-intl";

import availableLanguages, { type Language } from "./translations";
import { classNames } from "./util/classNames";

export const Footer = ({
  switchLanguage,
  selectedLocale,
}: {
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
}) => {
  const prefersDarkScheme =
    window?.matchMedia?.("(prefers-color-scheme: dark)") ?? false;

  return (
    <Popup
      contentStyle={{
        border: "none",
        borderRadius: "6px",
        boxShadow: "rgba(0, 0, 0, 0.4) 1px 1px 4px 0px",
        backgroundColor: prefersDarkScheme ? "#2d3848" : "#fff",
        padding: "0",
      }}
      arrowStyle={{
        color: prefersDarkScheme ? "#2d3848" : "#fff",
      }}
      trigger={
        <button className="border-none bg-background-highlight text-font-color text-sm cursor-pointer flex items-baseline p-1 rounded">
          <span role="img" aria-label="globe">
            🌍
          </span>{" "}
          <span>
            <FormattedMessage
              id="change_language"
              defaultMessage="Change Language"
            />
          </span>
        </button>
      }
      position="top center"
    >
      <div className="p-2 flex flex-col items-center max-h-96 overflow-y-scroll">
        {availableLanguages.map((language) => {
          return (
            <button
              key={`translation-${language.key}`}
              className={classNames(
                "border-none bg-background-highlight text-font-color text-base mb-2 p-1 rounded",
                selectedLocale === language.key ? "font-semibold" : ""
              )}
              onClick={() => switchLanguage(language)}
            >
              <span role="img" aria-label={`${language.name} Flag`}>
                {language.flag}
              </span>{" "}
              <span>{language.name}</span>
            </button>
          );
        })}
      </div>
    </Popup>
  );
};
