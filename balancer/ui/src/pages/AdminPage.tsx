import { useEffect, useRef, useState } from "react";
import { FormattedMessage, defineMessages, useIntl } from "react-intl";
import Popup from "reactjs-popup";

import { Card } from "@/components/Card";
import { CheatScoreGraph } from "@/components/CheatScoreGraph/CheatScoreGraph";
import { NotificationManager } from "@/components/NotificationManager";
import { ReadableTimestamp } from "@/components/ReadableTimestamp";

const buttonClasses =
  "inline m-0 bg-gray-700 text-white p-2 px-3 text-sm rounded-sm disabled:cursor-wait disabled:opacity-50";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const messages = defineMessages({
  admin_delete_team_confirmation: {
    id: "admin_delete_team_confirmation",
    defaultMessage: 'Are you sure you want to delete team "{team}"?',
  },
  admin_restart_team_confirmation: {
    id: "admin_restart_team_confirmation",
    defaultMessage: 'Are you sure you want to restart team "{team}"?',
  },
});

function RestartInstanceButton({ team }: { team: string }) {
  const intl = useIntl();
  const [restarting, setRestarting] = useState(false);

  const restart = async (event: React.MouseEvent) => {
    event.preventDefault();
    const confirmed = confirm(
      intl.formatMessage(messages.admin_restart_team_confirmation, { team })
    );
    if (!confirmed) {
      return;
    }
    setRestarting(true);
    try {
      await Promise.all([
        sleep(3000), // wait at least 3 seconds to signal to the user that the restart is happening, restart takes longer than the delete
        fetch(`/balancer/api/admin/teams/${team}/restart`, {
          method: "POST",
        }),
      ]);
    } finally {
      setRestarting(false);
    }
  };
  return (
    <button className={buttonClasses} disabled={restarting} onClick={restart}>
      {restarting ? (
        <FormattedMessage
          id="admin_table.restarting"
          defaultMessage="restarting..."
        />
      ) : (
        <FormattedMessage id="admin_table.restart" defaultMessage="restart" />
      )}
    </button>
  );
}

function DeleteInstanceButton({ team }: { team: string }) {
  const intl = useIntl();
  const [deleting, setDeleting] = useState(false);

  const remove = async (event: React.MouseEvent) => {
    event.preventDefault();
    const confirmed = confirm(
      intl.formatMessage(messages.admin_delete_team_confirmation, { team })
    );
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    try {
      await Promise.all([
        sleep(3000), // wait at least 3 seconds to signal to the user that the delete is happening
        fetch(`/balancer/api/admin/teams/${team}/delete`, {
          method: "DELETE",
        }),
      ]);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <button className={buttonClasses} disabled={deleting} onClick={remove}>
      {deleting ? (
        <FormattedMessage
          id="admin_table.deleting"
          defaultMessage="deleting..."
        />
      ) : (
        <FormattedMessage id="admin_table.delete" defaultMessage="delete" />
      )}
    </button>
  );
}

interface Team {
  team: string;
  ready: boolean;
  createdAt: Date;
  lastConnect: Date;
  cheatScore?: number;
  cheatScoreHistory?: {
    totalCheatScore: number;
    timestamp: string;
  }[];
}

interface TeamRaw {
  team: string;
  ready: boolean;
  createdAt: string;
  lastConnect: string;
  cheatScore?: number;
  cheatScoreHistory?: {
    totalCheatScore: number;
    timestamp: string;
  }[];
}

async function fetchAdminData(signal?: AbortSignal): Promise<Team[]> {
  const response = await fetch(`/balancer/api/admin/all`, { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch current teams");
  }
  const { instances } = (await response.json()) as { instances: TeamRaw[] };

  return instances.map((team) => ({
    ...team,
    createdAt: new Date(team.createdAt),
    lastConnect: new Date(team.lastConnect),
  }));
}

export default function AdminPage() {
  const intl = useIntl();
  const [teams, setTeams] = useState<Team[]>([]);
  const intervalRef = useRef<number | null>(null);

  const updateAdminDataRef = useRef<
    ((signal: AbortSignal) => Promise<void>) | null
  >(null);

  updateAdminDataRef.current = async (signal: AbortSignal) => {
    try {
      const data = await fetchAdminData(signal);
      setTeams(data);
    } catch (err) {
      // Ignore abort errors - these are expected when component unmounts
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("Failed to fetch current teams!", err);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();

    // Initial fetch
    updateAdminDataRef.current?.(abortController.signal);

    // Poll every 5 seconds
    intervalRef.current = window.setInterval(() => {
      updateAdminDataRef.current?.(abortController.signal);
    }, 5000);

    return () => {
      abortController.abort();
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 w-full lg:max-w-4xl">
      <NotificationManager />

      <h1 className="text-xl font-semibold">
        <FormattedMessage
          id="admin_table.table_header"
          defaultMessage="Active Teams"
        />
      </h1>

      {teams.length === 0 && (
        <span className="text-gray-700">
          <FormattedMessage
            id="admin_table.no_teams"
            defaultMessage="No active teams"
          />
        </span>
      )}

      {teams.map((team) => {
        const createdAt = new Date(team.createdAt);
        const lastConnect = new Date(team.lastConnect);

        return (
          <Card
            key={team.team}
            className="grid grid-cols-2 sm:grid-cols-5 items-center gap-8 gap-y-2 p-4"
          >
            <div>
              <h4 className="font-semibold">{team.team}</h4>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                <FormattedMessage
                  id="admin_table.created"
                  defaultMessage="created"
                />{" "}
                <ReadableTimestamp date={createdAt} />
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {team.ready ? (
                  <FormattedMessage
                    id="admin_table.instance_status.up_and_running"
                    defaultMessage="up and running 🟢"
                  />
                ) : (
                  <FormattedMessage
                    id="admin_table.instance_status.down"
                    defaultMessage="down ⚠️"
                  />
                )}
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {" "}
                <FormattedMessage
                  id="admin_table.latUsed"
                  defaultMessage="last used"
                />{" "}
                <ReadableTimestamp date={lastConnect} />
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              {team.cheatScore !== undefined ? (
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 inline-flex items-center gap-1">
                    <FormattedMessage
                      id="admin_table.cheat_score"
                      defaultMessage="Cheat Score"
                    />
                    <a
                      href="https://help.owasp-juice.shop/appendix/cheat-detection.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      title={intl.formatMessage({
                        id: "admin_table.cheat_score_tooltip",
                        defaultMessage:
                          "This score indicates if challenges are being solved faster than typically expected. It may not accurately identify actual cheating. Click to learn more.",
                      })}
                    >
                      ℹ️
                    </a>
                  </p>
                  {team.cheatScoreHistory &&
                  team.cheatScoreHistory.length > 1 ? (
                    <Popup
                      trigger={
                        <span
                          className="text-sm text-gray-800 dark:text-gray-200 cursor-help
                            border-b border-dotted border-transparent
                            hover:border-gray-400"
                        >
                          <br />
                          {(team.cheatScore * 100).toFixed(1)}%
                        </span>
                      }
                      position={["top center", "bottom center"]}
                      on="hover"
                      mouseEnterDelay={100}
                      arrow={true}
                      arrowStyle={{
                        color: "black",
                      }}
                      contentStyle={{
                        padding: "0px",
                        border: "none",
                        borderRadius: "0.25rem",
                      }}
                    >
                      <CheatScoreGraph
                        history={team.cheatScoreHistory}
                        teamname={team.team}
                      />
                    </Popup>
                  ) : (
                    <p
                      className="text-sm text-gray-800 dark:text-gray-200 cursor-help"
                      title={intl.formatMessage({
                        id: "admin_table.cheat_score_graph_not_available_yet",
                        defaultMessage:
                          "The cheat score graph will be available once more than one challenge is solved",
                      })}
                    >
                      {(team.cheatScore * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <FormattedMessage
                    id="admin_table.no_cheat_score"
                    defaultMessage="No cheat score"
                  />
                </p>
              )}
            </div>

            <DeleteInstanceButton team={team.team} />
            <RestartInstanceButton team={team.team} />
          </Card>
        );
      })}
    </div>
  );
}
