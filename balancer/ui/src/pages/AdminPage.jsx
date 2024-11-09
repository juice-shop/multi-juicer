import React, { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { ReadableTimestamp } from "../components/ReadableTimestamp";

import { Card } from "../Components";
import { SecondaryButton } from "../components/Button";

function RestartInstanceButton({ team }) {
  const [restarting, setRestarting] = useState(false);

  const restart = async (event) => {
    event.preventDefault();
    setRestarting(true);
    try {
      await fetch(`/balancer/api/admin/teams/${team}/restart`, {
        method: "POST",
      });
    } finally {
      setRestarting(false);
    }
  };
  return (
    <SecondaryButton onClick={restart} className="p-2 min-w-[70px] m-0">
      {restarting ? (
        <FormattedMessage
          id="admin_table.restarting"
          defaultMessage="Restarting..."
        />
      ) : (
        <FormattedMessage id="admin_table.restart" defaultMessage="Restart" />
      )}
    </SecondaryButton>
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function DeleteInstanceButton({ team }) {
  const [deleting, setDeleting] = useState(false);

  const remove = async (event) => {
    event.preventDefault();
    setDeleting(true);
    try {
      await Promise.all([
        sleep(3000),
        fetch(`/balancer/api/admin/teams/${team}/delete`, {
          method: "DELETE",
        }),
      ]);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <SecondaryButton
      onClick={remove}
      className="p-2 min-w-[70px] m-0 bg-red-500 text-white"
    >
      {deleting ? (
        <FormattedMessage
          id="admin_table.deleting"
          defaultMessage="Deleting..."
        />
      ) : (
        <FormattedMessage id="admin_table.delete" defaultMessage="Delete" />
      )}
    </SecondaryButton>
  );
}

function ValueDisplay({ label, value }) {
  return (
    <div className="inline-flex gap-2">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function AdminPage() {
  const [teams, setTeams] = useState([]);

  async function updateAdminData() {
    try {
      const response = await fetch(`/balancer/api/admin/all`);
      if (!response.ok) {
        throw new Error("Failed to fetch current teams");
      }
      const data = await response.json();
      setTeams(data.instances);
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
    <div className="flex flex-col gap-2 justify-start w-[70vw]">
      <h1>
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
          <Card key={team.team} className="flex flex-col gap-4 p-4">
            <div className="flex justify-start items-baseline gap-8">
              <h4>{team.team}</h4>
              <ValueDisplay
                label={
                  <FormattedMessage
                    id="admin_table.ready"
                    defaultMessage="Ready"
                  />
                }
                value={team.ready ? "✅" : "❌"}
              />
              <ValueDisplay
                label={
                  <FormattedMessage
                    id="admin_table.created"
                    defaultMessage="Created"
                  />
                }
                value={<ReadableTimestamp date={createdAt} />}
              />
              <ValueDisplay
                label={
                  <FormattedMessage
                    id="admin_table.latUsed"
                    defaultMessage="Last Used"
                  />
                }
                value={<ReadableTimestamp date={lastConnect} />}
              />
            </div>
            <div className="flex justify-start items-baseline gap-8">
              <DeleteInstanceButton team={team.team} />
              <RestartInstanceButton team={team.team} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
