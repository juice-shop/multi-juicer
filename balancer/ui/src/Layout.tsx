import { ReactNode, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Popup from "reactjs-popup";
import type { PopupActions } from "reactjs-popup/dist/types";

import { Card } from "@/components/Card";
import availableLanguages, { type Language } from "@/translations";
import { classNames } from "@/util/classNames";

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

function PasscodeResetMenuItem({
  activeTeam,
  closeMenu,
}: {
  activeTeam: string | null;
  closeMenu: () => void;
}) {
  const navigate = useNavigate();
  const intl = useIntl();
  const [isResetting, setIsResetting] = useState(false);

  async function resetPasscode() {
    if (!activeTeam) return;

    setIsResetting(true);
    try {
      const response = await fetch("/balancer/api/teams/reset-passcode", {
        method: "POST",
      });
      const data = await response.json();
      toast.success(
        intl.formatMessage({
          id: "passcode_reset_success",
          defaultMessage: "Passcode reset successfully",
        })
      );
      closeMenu();
      navigate(`/teams/${activeTeam}/status/`, {
        state: { passcode: data.passcode, reset: true },
      });
    } catch (error) {
      console.error("Failed to reset passcode", error);
      toast.error(
        intl.formatMessage({
          id: "passcode_reset_error",
          defaultMessage: "Failed to reset passcode",
        })
      );
    } finally {
      setIsResetting(false);
    }
  }

  if (!activeTeam || activeTeam === "admin") {
    return null;
  }

  return (
    <button
      disabled={isResetting}
      onClick={resetPasscode}
      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors cursor-pointer text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span role="img" aria-label="Reset Passcode">
        🔑
      </span>
      <span>
        <FormattedMessage id="reset_passcode" defaultMessage="Reset Passcode" />
      </span>
    </button>
  );
}

function LogoutMenuItem({
  setActiveTeam,
  activeTeam,
  closeMenu,
}: {
  setActiveTeam: (team: string | null) => void;
  activeTeam: string | null;
  closeMenu: () => void;
}) {
  const navigate = useNavigate();
  const intl = useIntl();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    const confirmed = confirm(
      intl.formatMessage({
        id: "logout_confirmation",
        defaultMessage:
          "Are you sure you want to logout? If you don't have the passcode saved, you won't be able to rejoin.",
      })
    );
    if (!confirmed) {
      return;
    }
    try {
      setActiveTeam(null);
      setIsLoggingOut(true);
      await fetch("/balancer/api/teams/logout", {
        method: "POST",
      });
      setIsLoggingOut(false);
      toast.success(
        intl.formatMessage({
          id: "logout_success",
          defaultMessage: "Logged out successfully",
        })
      );
      closeMenu();
      navigate("/");
    } catch (error) {
      console.error("Failed to log out", error);
      setIsLoggingOut(false);
    }
  }

  if (!activeTeam) {
    return null;
  }

  return (
    <button
      disabled={isLoggingOut}
      onClick={logout}
      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors cursor-pointer text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span role="img" aria-label="Logout">
        🚪
      </span>
      <span>
        <FormattedMessage id="log_out" defaultMessage="Log Out" />
      </span>
    </button>
  );
}

function ContextMenuContent({
  switchLanguage,
  selectedLocale,
  setActiveTeam,
  activeTeam,
  close,
}: {
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
  setActiveTeam: (team: string | null) => void;
  activeTeam: string | null;
  close: () => void;
}) {
  return (
    <div>
      <div className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
        <span role="img" aria-label="globe">
          🌐
        </span>{" "}
        <FormattedMessage
          id="change_language"
          defaultMessage="Change Language"
        />
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
      {activeTeam && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <div className="py-1">
            <PasscodeResetMenuItem activeTeam={activeTeam} closeMenu={close} />
            <LogoutMenuItem
              setActiveTeam={setActiveTeam}
              activeTeam={activeTeam}
              closeMenu={close}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ContextMenu({
  switchLanguage,
  selectedLocale,
  setActiveTeam,
  activeTeam,
}: {
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
  setActiveTeam: (team: string | null) => void;
  activeTeam: string | null;
}) {
  const prefersDarkScheme =
    window?.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

  const popupRef = useRef<PopupActions>(null);
  const close = () => popupRef.current?.close();

  return (
    <Popup
      ref={popupRef}
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
      <ContextMenuContent
        switchLanguage={switchLanguage}
        selectedLocale={selectedLocale}
        setActiveTeam={setActiveTeam}
        activeTeam={activeTeam}
        close={close}
      />
    </Popup>
  );
}

function Navigation({
  activeTeam,
  switchLanguage,
  selectedLocale,
  setActiveTeam,
}: {
  activeTeam: string | null;
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
  setActiveTeam: (team: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg gap-2">
        {activeTeam && activeTeam !== "admin" && (
          <NavbarPill to={`/teams/${activeTeam}/status`}>
            <FormattedMessage id="navigation.team" defaultMessage="Your Team" />
          </NavbarPill>
        )}
        {activeTeam && activeTeam === "admin" && (
          <NavbarPill to="/admin">
            <FormattedMessage id="navigation.admin" defaultMessage="Admin" />
          </NavbarPill>
        )}
        <NavbarPill to="/score-overview" activeMatchingExact={true}>
          <FormattedMessage
            id="navigation.scoreboard"
            defaultMessage="Score Overview"
          />
        </NavbarPill>
      </div>
      <ContextMenu
        switchLanguage={switchLanguage}
        selectedLocale={selectedLocale}
        setActiveTeam={setActiveTeam}
        activeTeam={activeTeam}
      />
    </div>
  );
}

export function Layout({
  children,
  switchLanguage,
  selectedLocale,
  activeTeam,
  setActiveTeam,
}: {
  children: React.ReactNode;
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
  activeTeam: string | null;
  setActiveTeam: (team: string | null) => void;
}) {
  let primaryBackLink = "/";
  if (activeTeam === "admin") {
    primaryBackLink = "/admin";
  } else if (activeTeam !== null) {
    primaryBackLink = `/teams/${activeTeam}/status`;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      <header>
        <Card className="p-2 sm:p-4 flex justify-between items-center flex-col sm:flex-row gap-y-3">
          <Link to={primaryBackLink} className="flex items-center gap-3">
            <img
              src="/balancer/multi-juicer.svg"
              alt="MultiJuicer Logo"
              className="h-12"
            />
          </Link>

          <Navigation
            activeTeam={activeTeam}
            switchLanguage={switchLanguage}
            selectedLocale={selectedLocale}
            setActiveTeam={setActiveTeam}
          />
        </Card>
      </header>

      <main className="flex flex-col items-center justify-center">
        {children}
      </main>
    </div>
  );
}
