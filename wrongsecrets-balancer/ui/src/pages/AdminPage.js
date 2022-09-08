import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import DataTable, { createTheme } from 'react-data-table-component';
import { FormattedRelativeTime, defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { selectUnit } from '@formatjs/intl-utils';

import { BodyCard, SecondaryButton } from '../Components';

// create react-data-table theme
createTheme('multijuicer', {
  text: {
    primary: 'var(--font-color)',
    secondary: 'var(--font-color-highlight)',
  },
  sortFocus: {
    default: 'var(--font-color-highlight)',
  },
  highlightOnHover: {
    default: 'var(--font-color-highlight)',
    text: 'var(--font-color-highlight)',
  },
  background: {
    default: 'var(--background-color)',
  },
  context: {
    background: '#cb4b16',
    text: '#FFFFFF',
  },
  divider: {
    default: '#073642',
  },
  action: {
    button: 'rgba(0,0,0,.54)',
    hover: 'rgba(0,0,0,.08)',
    disabled: 'rgba(0,0,0,.12)',
  },
});

const SmallSecondary = styled(SecondaryButton)`
  padding: 8px;
  min-width: 70px;
`;

const WarnSmallSecondary = styled(SmallSecondary)`
  padding: 8px;
  min-width: 70px;
  background-color: #ef4444;
  color: var(--font-color);
`;

const BigBodyCard = styled(BodyCard)`
  width: 70vw;
  max-width: initial;
`;

const Text = styled.span`
  color: var(--font-color);
`;

const messages = defineMessages({
  tableHeader: {
    id: 'admin_table.table_header',
    defaultMessage: 'Active Teams',
  },
  teamname: {
    id: 'admin_table.teamname',
    defaultMessage: 'Teamname',
  },
  ready: {
    id: 'admin_table.ready',
    defaultMessage: 'Ready',
  },
  created: {
    id: 'admin_table.created',
    defaultMessage: 'Created',
  },
  lastUsed: {
    id: 'admin_table.lastUsed',
    defaultMessage: 'Last Used',
  },
  actions: {
    id: 'admin_table.actions',
    defaultMessage: 'Actions',
  },
  noContent: {
    id: 'admin_table.noActiveTeams',
    defaultMessage: 'No active teams',
  },
});

function RestartInstanceButton({ team }) {
  const [restarting, setRestarting] = useState(false);

  const restart = (event) => {
    event.preventDefault();
    setRestarting(true);
    axios.post(`/balancer/admin/teams/${team}/restart`).finally(() => setRestarting(false));
  };
  return (
    <SmallSecondary onClick={restart}>
      {restarting ? (
        <FormattedMessage id="admin_table.restarting" defaultMessage="Restarting..." />
      ) : (
        <FormattedMessage id="admin_table.restart" defaultMessage="Restart" />
      )}
    </SmallSecondary>
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function DeleteInstanceButton({ team }) {
  const [deleting, setDeleting] = useState(false);

  const remove = (event) => {
    event.preventDefault();
    setDeleting(true);

    Promise.all([sleep(3000), axios.delete(`/balancer/admin/teams/${team}/delete`)]).finally(() =>
      setDeleting(false)
    );
  };
  return (
    <WarnSmallSecondary onClick={remove}>
      {deleting ? (
        <FormattedMessage id="admin_table.deleting" defaultMessage="Deleting..." />
      ) : (
        <FormattedMessage id="admin_table.delete" defaultMessage="Delete" />
      )}
    </WarnSmallSecondary>
  );
}

export default function AdminPage() {
  const [teams, setTeams] = useState([]);
  const { formatMessage, formatDate } = useIntl();

  function updateAdminData() {
    return axios
      .get(`/balancer/admin/all`)
      .then(({ data }) => {
        setTeams(data.instances);
      })
      .catch((err) => {
        console.error('Failed to fetch current teams!', err);
      });
  }

  useEffect(() => {
    updateAdminData();

    const interval = setInterval(updateAdminData, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const columns = [
    {
      name: formatMessage(messages.teamname),
      selector: 'team',
      sortable: true,
    },
    {
      name: formatMessage(messages.ready),
      selector: 'ready',
      sortable: true,
      right: true,
      // ready is just a emoji, so the colum can shrink
      grow: 0,
      format: ({ ready }) => (ready ? '✅' : '❌'),
    },
    {
      name: formatMessage(messages.created),
      selector: 'createdAt',
      sortable: true,
      format: ({ createdAt }) => {
        const { value, unit } = selectUnit(createdAt);
        return (
          <Text title={createdAt}>
            <FormattedRelativeTime value={value} unit={unit} />
          </Text>
        );
      },
    },
    {
      name: formatMessage(messages.lastUsed),
      selector: 'lastConnect',
      sortable: true,
      format: ({ lastConnect }) => {
        const { value, unit } = selectUnit(lastConnect);
        return (
          <Text title={formatDate(lastConnect)}>
            <FormattedRelativeTime value={value} unit={unit} />
          </Text>
        );
      },
    },
    {
      name: formatMessage(messages.actions),
      selector: 'actions',
      right: true,
      cell: ({ team }) => {
        return (
          <>
            <DeleteInstanceButton team={team} />
            <RestartInstanceButton team={team} />
          </>
        );
      },
      ignoreRowClick: true,
      button: true,
      minWidth: '200px',
    },
  ];

  return (
    <BigBodyCard>
      <DataTable
        theme="multijuicer"
        title={formatMessage(messages.tableHeader)}
        noDataComponent={formatMessage(messages.noContent)}
        defaultSortField="lastConnect"
        defaultSortAsc={false}
        columns={columns}
        data={teams}
        keyField="team"
      />
    </BigBodyCard>
  );
}
