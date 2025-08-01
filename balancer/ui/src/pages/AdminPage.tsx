import { useEffect, useState } from "react";
import { FormattedMessage, defineMessages, useIntl } from "react-intl";

import { Card } from "@/components/Card";
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
    id: "admin_delete_team_confirmation",
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
        sleep(10000), // wait at least 3 seconds to signal to the user that the restart is happening, restart takes longer than the delete
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
}

interface TeamRaw {
  team: string;
  ready: boolean;
  createdAt: string;
  lastConnect: string;
}

async function fetchAdminData(): Promise<Team[]> {
  const response = await fetch(`/balancer/api/admin/all`);
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
  const [teams, setTeams] = useState<Team[]>([]);

  async function updateAdminData() {
    try {
      const response = await fetch(`/balancer/api/admin/all`);
      if (!response.ok) {
        throw new Error("Failed to fetch current teams");
      }
      setTeams(await fetchAdminData());
    } catch (err) {
      console.error("Failed to fetch current teams!", err);
    }
  }

  useEffect(() => {
    updateAdminData();

    const interval = setInterval(updateAdminData, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full lg:max-w-4xl">
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
            className="grid grid-cols-2 sm:grid-cols-4 items-center gap-8 gap-y-2 p-4"
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
                {team.ready ? "up and running 🟢" : "down ⚠️"}
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

            <DeleteInstanceButton team={team.team} />
            <RestartInstanceButton team={team.team} />
          </Card>
        );
      })}
    </div>
  );
}
