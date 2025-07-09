import { FormattedMessage } from "react-intl";
import { classNames } from "../util/classNames";

type View = "scoreboard" | "statistics";

interface ViewToggleProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export const ViewToggle = ({ currentView, onViewChange }: ViewToggleProps) => {
  const baseClasses = "px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500";
  const activeClasses = "bg-orange-500 text-white";
  const inactiveClasses = "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600";

  return (
    <div className="flex justify-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
      <button
        onClick={() => onViewChange("scoreboard")}
        className={classNames(baseClasses, currentView === "scoreboard" ? activeClasses : inactiveClasses)}
      >
        <FormattedMessage id="view_toggle.scoreboard" defaultMessage="Scoreboard" />
      </button>
      <button
        onClick={() => onViewChange("statistics")}
        className={classNames(baseClasses, currentView === "statistics" ? activeClasses : inactiveClasses)}
      >
        <FormattedMessage id="view_toggle.statistics" defaultMessage="Statistics" />
      </button>
    </div>
  );
};