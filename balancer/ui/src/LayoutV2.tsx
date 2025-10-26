import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import Popup from "reactjs-popup";

import { Card } from "./components/Card";
import availableLanguages, { type Language } from "./translations";
import { classNames } from "./util/classNames";

export function NavbarPill({
  children,
  to,
  activeMatchingExact = false,
}: {
  children: ReactNode;
  to: string;
  activeMatchingExact?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={activeMatchingExact}
      className={({ isActive }) =>
        classNames(
          "px-4 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-orange-500 text-white"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        )
      }
    >
      {children}
    </NavLink>
  );
}

function LanguageMenuItem({
  language,
  isSelected,
  onSelect,
}: {
  language: Language;
  isSelected: boolean;
  onSelect: (language: Language) => void;
}) {
  return (
    <button
      onClick={() => onSelect(language)}
      className={classNames(
        "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors cursor-pointer",
        isSelected
          ? "font-semibold text-orange-500"
          : "text-gray-700 dark:text-gray-300"
      )}
    >
      <span role="img" aria-label={`${language.name} Flag`}>
        {language.flag}
      </span>
      <span>{language.name}</span>
    </button>
  );
}

function ContextMenu({
  switchLanguage,
  selectedLocale,
}: {
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
}) {
  const prefersDarkScheme =
    window?.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

  return (
    <Popup
      contentStyle={{
        border: "none",
        borderRadius: "8px",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        backgroundColor: prefersDarkScheme ? "#1f2937" : "#fff",
        padding: "0.5rem 0",
        width: "16rem",
        zIndex: 50,
      }}
      arrowStyle={{
        color: prefersDarkScheme ? "#1f2937" : "#fff",
      }}
      trigger={
        <button
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors cursor-pointer"
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>
      }
      position="bottom right"
      closeOnDocumentClick
    >
      <div>
        <div className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          🌐 Switch Language
        </div>
        <div className="py-1">
          {availableLanguages.map((language) => (
            <LanguageMenuItem
              key={language.key}
              language={language}
              isSelected={selectedLocale === language.key}
              onSelect={switchLanguage}
            />
          ))}
        </div>
      </div>
    </Popup>
  );
}

function Navigation({
  switchLanguage,
  selectedLocale,
}: {
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg gap-2">
        <NavbarPill to="/">Team</NavbarPill>
        <NavbarPill to="/v2" activeMatchingExact={true}>
          ScoreBoard
        </NavbarPill>
      </div>
      <ContextMenu
        switchLanguage={switchLanguage}
        selectedLocale={selectedLocale}
      />
    </div>
  );
}

export function LayoutV2({
  children,
  switchLanguage,
  selectedLocale,
}: {
  children: React.ReactNode;
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
  activeTeam: string | null;
}) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      <header>
        <Card className="p-4 flex justify-between items-center">
          <Link to="/v2" className="flex items-center gap-3">
            <img
              src="/balancer/multi-juicer.svg"
              alt="MultiJuicer Logo"
              className="h-12"
            />
          </Link>

          <Navigation
            switchLanguage={switchLanguage}
            selectedLocale={selectedLocale}
          />
        </Card>
      </header>

      <main className="flex flex-col items-center justify-center">
        {children}
      </main>
    </div>
  );
}
