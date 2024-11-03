import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { FormattedMessage } from "react-intl";
import { ReadableTimestamp } from "../components/ReadableTimestamp";

import { Card, H4, SecondaryButton } from "../Components";

const SmallSecondary = styled(SecondaryButton)`
  padding: 8px;
  min-width: 70px;
  margin: 0;
`;

const WarnSmallSecondary = styled(SmallSecondary)`
  padding: 8px;
  min-width: 70px;
  background-color: #ef4444;
  color: var(--font-color);
`;

const Text = styled.span`
  color: var(--font-color);
`;

function RestartInstanceButton({ team }) {
  const [restarting, setRestarting] = useState(false);

  const restart = async (event) => {
    event.preventDefault();
    setRestarting(true);
    try {
      await fetch(`/balancer/admin/teams/${team}/restart`, {
        method: "POST",
      });
    } finally {
      setRestarting(false);
    }
  };
  return (
    <SmallSecondary onClick={restart}>
      {restarting ? (
        <FormattedMessage
          id="admin_table.restarting"
          defaultMessage="Restarting..."
        />
      ) : (
        <FormattedMessage id="admin_table.restart" defaultMessage="Restart" />
      )}
    </SmallSecondary>
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
        fetch(`/balancer/admin/teams/${team}/delete`, {
          method: "DELETE",
        }),
      ]);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <WarnSmallSecondary onClick={remove}>
      {deleting ? (
        <FormattedMessage
          id="admin_table.deleting"
          defaultMessage="Deleting..."
        />
      ) : (
        <FormattedMessage id="admin_table.delete" defaultMessage="Delete" />
      )}
    </WarnSmallSecondary>
  );
}

const AdminPageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  justify-content: flex-start;
  width: 70vw;
`;

const AdminCardRow = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: baseline;
  gap: 2rem;
`;

const ValueDisplayWrapper = styled.div`
  display: inline-flex;
  gap: 0.5rem;

  strong {
    font-weight: bold;
  }
`;

function ValueDisplay({ label, value }) {
  return (
    <ValueDisplayWrapper>
      <span>{label}</span>
      <strong>{value}</strong>
    </ValueDisplayWrapper>
  );
}

const TeamCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
`;

export default function AdminPage() {
  const [teams, setTeams] = useState([]);

  async function updateAdminData() {
    try {
      const response = await fetch(`/balancer/admin/all`);
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
    <AdminPageWrapper>
      <h1>
        <FormattedMessage
          id="admin_table.table_header"
          defaultMessage="Active Teams"
        />
      </h1>

      {teams.length === 0 && (
        <Text>
          <FormattedMessage
            id="admin_table.no_teams"
            defaultMessage="No active teams"
          />
        </Text>
      )}

      {teams.map((team) => {
        const createdAt = new Date(team.createdAt);
        const lastConnect = new Date(team.lastConnect);

        return (
          <TeamCard key={team.team}>
            <AdminCardRow>
              <H4>{team.team}</H4>
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
            </AdminCardRow>
            <AdminCardRow>
              <DeleteInstanceButton team={team.team} />
              <RestartInstanceButton team={team.team} />
            </AdminCardRow>
          </TeamCard>
        );
      })}
    </AdminPageWrapper>
  );
}
