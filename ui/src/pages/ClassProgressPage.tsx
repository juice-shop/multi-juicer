import { Fragment, type ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";

import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { useChallenges } from "@/hooks/useChallenges";
import {
  type ClassProgressTeam,
  useClassProgress,
} from "@/hooks/useClassProgress";
import { uiConfig } from "@/lib/uiConfig";
import { classNames } from "@/util/classNames";

type SortOrder = "name" | "progress";

function sortTeams(teams: ClassProgressTeam[], sortOrder: SortOrder) {
  const byName = (a: ClassProgressTeam, b: ClassProgressTeam) =>
    a.name.localeCompare(b.name);
  if (sortOrder === "name") {
    return [...teams].sort(byName);
  }
  return [...teams].sort(
    (a, b) =>
      b.solvedChallenges.length - a.solvedChallenges.length || byName(a, b)
  );
}

function DetailLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  if (!uiConfig.views.scoreOverview.enabled) {
    return children;
  }
  return (
    <Link to={to} className={classNames("hover:underline", className)}>
      {children}
    </Link>
  );
}

export const ClassProgressPage = ({
  activeTeam,
}: {
  activeTeam: string | null;
}) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const { data: teams, isLoading, error } = useClassProgress();
  const { data: challenges } = useChallenges();
  const { groups } = uiConfig.views.classProgress;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Spinner />
        <p>
          <FormattedMessage
            id="class_progress.loading"
            defaultMessage="Loading Class Progress..."
          />
        </p>
      </div>
    );
  }

  if (error || !teams) {
    return (
      <p className="text-red-500">
        <FormattedMessage
          id="class_progress.error"
          defaultMessage="Could not load class progress. Retrying..."
        />
      </p>
    );
  }

  const challengeNames = new Map(
    challenges?.map((challenge) => [challenge.key, challenge.name])
  );
  const columns = groups.flatMap((group, groupIndex) =>
    group.challenges.map((key, index) => ({
      key,
      hasSpacer: groupIndex > 0 && index === 0,
    }))
  );
  const doneCount = teams.filter(
    (team) => team.solvedChallenges.length === columns.length
  ).length;

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            <FormattedMessage
              id="class_progress.title"
              defaultMessage="Class Progress"
            />
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <FormattedMessage
              id="class_progress.summary"
              defaultMessage="{doneTeams} of {totalTeams, plural, one {# team} other {# teams}} have solved {challengeCount, plural, one {the challenge} other {all # challenges}}"
              values={{
                doneTeams: (
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {doneCount}
                  </span>
                ),
                totalTeams: teams.length,
                challengeCount: columns.length,
              }}
            />
          </p>
        </div>
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
          {(["name", "progress"] as const).map((order) => (
            <button
              type="button"
              key={order}
              onClick={() => setSortOrder(order)}
              className={classNames(
                "px-3 py-1 rounded-md cursor-pointer transition-colors",
                sortOrder === order
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {order === "name" ? (
                <FormattedMessage
                  id="class_progress.sort.name"
                  defaultMessage="By name"
                />
              ) : (
                <FormattedMessage
                  id="class_progress.sort.progress"
                  defaultMessage="By progress"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="p-3 text-left align-bottom text-xs uppercase tracking-wide"
              >
                <FormattedMessage
                  id="class_progress.header.team"
                  defaultMessage="Team"
                />
              </th>
              <th
                rowSpan={2}
                className="p-3 text-left align-bottom text-xs uppercase tracking-wide"
              >
                <FormattedMessage
                  id="class_progress.header.progress"
                  defaultMessage="Progress"
                />
              </th>
              {groups.map((group, groupIndex) => (
                <Fragment key={group.name}>
                  {groupIndex > 0 && <th className="w-3" />}
                  <th
                    colSpan={group.challenges.length}
                    className="px-1 pt-3 pb-1 border-b-2 border-green-500 text-xs font-semibold text-green-700 dark:text-green-400"
                  >
                    {group.name}
                  </th>
                </Fragment>
              ))}
            </tr>
            <tr>
              {columns.map(({ key, hasSpacer }) => (
                <Fragment key={key}>
                  {hasSpacer && <th />}
                  <th className="px-0.5 py-2 align-bottom text-center font-normal">
                    <span className="inline-block align-bottom whitespace-nowrap text-xs rotate-180 [writing-mode:vertical-rl]">
                      <DetailLink to={`/score-overview/challenges/${key}`}>
                        {challengeNames.get(key) ?? key}
                      </DetailLink>
                    </span>
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 && (
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td
                  colSpan={2 + columns.length + groups.length - 1}
                  className="p-3 text-center text-gray-500 dark:text-gray-400"
                >
                  <FormattedMessage
                    id="class_progress.no_teams"
                    defaultMessage="No teams have joined yet."
                  />
                </td>
              </tr>
            )}
            {sortTeams(teams, sortOrder).map((team) => {
              const isActiveTeam = team.name === activeTeam;
              return (
                <tr
                  key={team.name}
                  className={classNames(
                    "border-t border-gray-200 dark:border-gray-700",
                    isActiveTeam && "bg-orange-50 dark:bg-orange-500/10"
                  )}
                >
                  <td
                    className={classNames(
                      "px-3 py-1.5 whitespace-nowrap",
                      isActiveTeam && "font-bold"
                    )}
                  >
                    <DetailLink
                      to={`/score-overview/teams/${team.name}`}
                      className="text-blue-500"
                    >
                      {team.name}
                    </DetailLink>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-gray-600 dark:text-gray-300">
                    {team.solvedChallenges.length}/{columns.length}
                  </td>
                  {columns.map(({ key, hasSpacer }) => {
                    const solved = team.solvedChallenges.includes(key);
                    return (
                      <Fragment key={key}>
                        {hasSpacer && <td />}
                        <td className="px-0.5 py-1 text-center">
                          <span
                            className={classNames(
                              "inline-flex h-5 w-5 align-middle items-center justify-center rounded text-[10px] text-white",
                              solved
                                ? "bg-green-500"
                                : "bg-gray-100 dark:bg-gray-700"
                            )}
                          >
                            {solved ? "✓" : ""}
                          </span>
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
              <td colSpan={2} className="px-3 py-2">
                <FormattedMessage
                  id="class_progress.solved_by"
                  defaultMessage="Solved by"
                />
              </td>
              {columns.map(({ key, hasSpacer }) => (
                <Fragment key={key}>
                  {hasSpacer && <td />}
                  <td className="py-2 text-center tabular-nums">
                    {
                      teams.filter((team) =>
                        team.solvedChallenges.includes(key)
                      ).length
                    }
                  </td>
                </Fragment>
              ))}
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
};

export default ClassProgressPage;
