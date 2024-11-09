import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { ReadableTimestamp } from "../components/ReadableTimestamp";

import { Card } from "../Components";

const buttonClasses =
  "inline m-0 bg-gray-700 text-white p-2 px-3 text-sm rounded disabled:cursor-wait disabled:opacity-50";

function RestartInstanceButton({ team }: { team: string }) {
  const [restarting, setRestarting] = useState(false);

  const restart = async (event: React.MouseEvent) => {
    event.preventDefault();
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function DeleteInstanceButton({ team }: { team: string }) {
  const [deleting, setDeleting] = useState(false);

  const remove = async (event: React.MouseEvent) => {
    event.preventDefault();
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
    <div className="flex flex-col gap-2 w-full max-w-3xl">
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
              <p className="text-sm text-gray-200">
                <FormattedMessage
                  id="admin_table.created"
                  defaultMessage="created"
                />{" "}
                <ReadableTimestamp date={createdAt} />
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-200">
                {team.ready ? "up and running 🟢" : "down ⚠️"}
              </p>
              <p className="text-sm text-gray-200">
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
