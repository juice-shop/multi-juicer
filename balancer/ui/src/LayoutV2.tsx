import { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Card } from './components/Card';
import { classNames } from './util/classNames';

const navLinkClasses = "px-4 py-2 rounded-md text-sm font-medium transition-colors";
const activeNavLinkClasses = "bg-orange-500 text-white";
const inactiveNavLinkClasses = "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700";

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
              className="h-10" // Smaller logo
            />
          </Link>

          {/* Navigation Toggle */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <NavLink
              to="/v2"
              end // 'end' prop ensures this only matches the exact path
              className={({ isActive }) => classNames(navLinkClasses, isActive ? activeNavLinkClasses : inactiveNavLinkClasses)}
            >
              Leaderboard
            </NavLink>
            <NavLink
              to="/v2/statistics"
              className={({ isActive }) => classNames(navLinkClasses, isActive ? activeNavLinkClasses : inactiveNavLinkClasses)}
            >
              Statistics
            </NavLink>
          </div>
        </Card>
      </header>

      <main className="flex flex-col items-center justify-center">
        {children}
      </main>
    </div>
  );
};