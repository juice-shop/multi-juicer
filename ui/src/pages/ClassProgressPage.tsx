import { useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";

import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import {
  type ClassProgressChallenge,
  type ClassProgressTeam,
  useClassProgress,
} from "@/hooks/useClassProgress";
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
      b.mandatorySolved - a.mandatorySolved ||
      b.suggestedSolved - a.suggestedSolved ||
      byName(a, b)
  );
}

function ChallengeHeader({ challenge }: { challenge: ClassProgressChallenge }) {
  return (
    <th className="px-0.5 py-2 align-bottom text-center font-normal">
      <Link
        to={`/score-overview/challenges/${challenge.key}`}
        className="inline-block align-bottom whitespace-nowrap text-xs rotate-180 [writing-mode:vertical-rl] hover:underline"
      >
        {challenge.name}
      </Link>
    </th>
  );
}

function ChallengeCell({ solved, color }: { solved: boolean; color: string }) {
  return (
    <td className="px-0.5 py-1 text-center">
      <span
        className={classNames(
          "inline-flex h-5 w-5 align-middle items-center justify-center rounded text-[10px] text-white",
          solved ? color : "bg-gray-100 dark:bg-gray-700"
        )}
      >
        {solved ? "✓" : ""}
      </span>
    </td>
  );
}

function ClassProgressTable({
  mandatory,
  suggested,
  teams,
  activeTeam,
}: {
  mandatory: ClassProgressChallenge[];
  suggested: ClassProgressChallenge[];
  teams: ClassProgressTeam[];
  activeTeam: string | null;
}) {
  const hasMandatory = mandatory.length > 0;
  const hasSuggested = suggested.length > 0;
  const hasSpacer = hasMandatory && hasSuggested;
  const columnCount =
    1 +
    (hasMandatory ? 1 + mandatory.length : 0) +
    (hasSpacer ? 1 : 0) +
    suggested.length;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide">
          <th rowSpan={2} className="p-3 text-left align-bottom">
            <FormattedMessage
              id="class_progress.header.team"
              defaultMessage="Team"
            />
          </th>
          {hasMandatory && (
            <>
              <th rowSpan={2} className="p-3 text-left align-bottom">
                <FormattedMessage
                  id="class_progress.header.status"
                  defaultMessage="Status"
                />
              </th>
              <th
                colSpan={mandatory.length}
                className="pt-3 pb-1 border-b-2 border-orange-500 text-orange-600 dark:text-orange-400"
              >
                <FormattedMessage
                  id="class_progress.header.mandatory"
                  defaultMessage="Mandatory"
                />
              </th>
            </>
          )}
          {hasSpacer && <th className="w-3" />}
          {hasSuggested && (
            <th
              colSpan={suggested.length}
              className="pt-3 pb-1 border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
            >
              <FormattedMessage
                id="class_progress.header.suggested"
                defaultMessage="Suggested"
              />
            </th>
          )}
        </tr>
        <tr>
          {mandatory.map((challenge) => (
            <ChallengeHeader key={challenge.key} challenge={challenge} />
          ))}
          {hasSpacer && <th />}
          {suggested.map((challenge) => (
            <ChallengeHeader key={challenge.key} challenge={challenge} />
          ))}
        </tr>
      </thead>
      <tbody>
        {teams.length === 0 && (
          <tr className="border-t border-gray-200 dark:border-gray-700">
            <td
              colSpan={columnCount}
              className="p-3 text-center text-gray-500 dark:text-gray-400"
            >
              <FormattedMessage
                id="class_progress.no_teams"
                defaultMessage="No teams have joined yet."
              />
            </td>
          </tr>
        )}
        {teams.map((team) => {
          const solved = new Set(team.solvedChallenges);
          const isActiveTeam = team.name === activeTeam;
          return (
            <tr
              key={team.name}
              className={classNames(
                "border-t border-gray-200 dark:border-gray-700",
                isActiveTeam ? "bg-orange-50 dark:bg-orange-500/10" : ""
              )}
            >
              <td className="px-3 py-1.5 whitespace-nowrap">
                <Link
                  to={`/score-overview/teams/${team.name}`}
                  className={classNames(
                    "text-blue-500 hover:underline",
                    isActiveTeam ? "font-bold" : ""
                  )}
                >
                  {team.name}
                </Link>
              </td>
              {hasMandatory && (
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {team.mandatorySolved === mandatory.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 text-xs font-semibold">
                      ✓{" "}
                      <FormattedMessage
                        id="class_progress.done"
                        defaultMessage="Done"
                      />
                    </span>
                  ) : (
                    <span className="tabular-nums text-gray-600 dark:text-gray-300">
                      {team.mandatorySolved}/{mandatory.length}
                    </span>
                  )}
                </td>
              )}
              {mandatory.map((challenge) => (
                <ChallengeCell
                  key={challenge.key}
                  solved={solved.has(challenge.key)}
                  color="bg-green-500"
                />
              ))}
              {hasSpacer && <td />}
              {suggested.map((challenge) => (
                <ChallengeCell
                  key={challenge.key}
                  solved={solved.has(challenge.key)}
                  color="bg-blue-500"
                />
              ))}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
          <td colSpan={hasMandatory ? 2 : 1} className="px-3 py-2">
            <FormattedMessage
              id="class_progress.solved_by"
              defaultMessage="Solved by"
            />
          </td>
          {mandatory.map((challenge) => (
            <td key={challenge.key} className="py-2 text-center tabular-nums">
              {challenge.solveCount}
            </td>
          ))}
          {hasSpacer && <td />}
          {suggested.map((challenge) => (
            <td key={challenge.key} className="py-2 text-center tabular-nums">
              {challenge.solveCount}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

export const ClassProgressPage = ({
  activeTeam,
}: {
  activeTeam: string | null;
}) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const { data: classProgress, isLoading, error } = useClassProgress();

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

  if (error || !classProgress) {
    return (
      <p className="text-red-500">
        {error === "Class progress not configured" ? (
          <FormattedMessage
            id="class_progress.not_configured"
            defaultMessage="Class progress is not configured."
          />
        ) : (
          <FormattedMessage
            id="class_progress.error"
            defaultMessage="Could not load class progress. Retrying..."
          />
        )}
      </p>
    );
  }

  const mandatoryCount = classProgress.mandatory.length;
  const doneCount = classProgress.teams.filter(
    (team) => team.mandatorySolved === mandatoryCount
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
          {mandatoryCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <FormattedMessage
                id="class_progress.summary"
                defaultMessage="{doneTeams} of {totalTeams, plural, one {# team} other {# teams}} have solved {mandatoryCount, plural, one {the mandatory challenge} other {all # mandatory challenges}}"
                values={{
                  doneTeams: (
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {doneCount}
                    </span>
                  ),
                  totalTeams: classProgress.teams.length,
                  mandatoryCount,
                }}
              />
            </p>
          )}
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
        <ClassProgressTable
          mandatory={classProgress.mandatory}
          suggested={classProgress.suggested}
          teams={sortTeams(classProgress.teams, sortOrder)}
          activeTeam={activeTeam}
        />
      </Card>
    </div>
  );
};

export default ClassProgressPage;
