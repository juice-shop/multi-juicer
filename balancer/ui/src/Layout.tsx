import React from "react";

import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";
import Popup from "reactjs-popup";

import availableLanguages, { type Language } from "./translations";
import { classNames } from "./util/classNames";
import { Card } from "./components/Card";

const pageMargins = "2xl:mx-80 lg:mx-48 md:mx-24 sm:mx-16 mx-2";

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

export function Layout({
  children,
  switchLanguage,
  selectedLocale,
  activeTeam,
}: {
  children: React.ReactNode;
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
  activeTeam: string | null;
}) {
  let primaryBackLink = "/";
  if (activeTeam === "admin") {
    primaryBackLink = "/admin";
  } else if (activeTeam !== null) {
    primaryBackLink = `/teams/${activeTeam}/status`;
  }

  return (
    <div className="grid grid-rows-[min-content_auto_min-content] h-screen w-screen gap-6">
      <div className={classNames("min-h-32 mt-3 md:mt-8", pageMargins)}>
        <Link to={primaryBackLink}>
          <Card className="flex items-center justify-center bg-background-highlight p-5">
            <img
              src="/balancer/multi-juicer.svg"
              alt="MultiJuicer Logo"
              className="max-h-24"
            />
          </Card>
        </Link>
      </div>
      <div
        className={classNames(
          "flex flex-col items-center justify-center",
          pageMargins
        )}
      >
        {children}
      </div>
      <footer className="flex justify-center mb-3 md:mb-8">
        <Footer
          switchLanguage={switchLanguage}
          selectedLocale={selectedLocale}
        />
      </footer>
    </div>
  );
}
