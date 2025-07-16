import { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { Card } from "./components/Card";
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

export const LayoutV2 = ({ children }: { children: ReactNode }) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      <header>
        <Card className="p-4 flex justify-between items-center">
          {/* Logo */}
          <Link to="/v2" className="flex items-center gap-3">
            <img
              src="/balancer/multi-juicer.svg"
              alt="MultiJuicer Logo"
              className="h-12"
            />
          </Link>

          {/* Navigation */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg gap-2">
            <NavbarPill to="/">Team</NavbarPill>
            <NavbarPill to="/v2" activeMatchingExact={true}>
              Leaderboard
            </NavbarPill>
            <NavbarPill to="/v2/statistics">Statistics</NavbarPill>
          </div>
        </Card>
      </header>

      <main className="flex flex-col items-center justify-center">
        {children}
      </main>
    </div>
  );
};
