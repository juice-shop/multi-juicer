import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { withRouter } from 'react-router-dom';
import axios from 'axios';
import DataTable from 'react-data-table-component';
import neatime from 'neatime';

import { Layout } from '../Layout';
import { BodyCard } from '../Components';

const BigBodyCard = styled(BodyCard)`
  width: 60vw;
  max-width: 850px;
`;

export default withRouter(() => {
  const [teams, setTeams] = useState([]);

  function updateAdminData() {
    return axios.get(`/balancer/admin/all`).then(({ data }) => {
      setTeams(data.instances);
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
      name: 'Teamname',
      selector: 'team',
      sortable: true,
    },
    {
      name: 'Ready',
      selector: 'ready',
      sortable: true,
      right: true,
      format: ready => (ready ? '✅' : '❌'),
    },
    {
      name: 'Created',
      selector: 'createdAt',
      sortable: true,
      format: ({ createdAt }) => neatime(new Date(createdAt)),
    },
    {
      name: 'Last Used',
      selector: 'lastConnect',
      sortable: true,
      format: ({ lastConnect }) => neatime(new Date(lastConnect)),
    },
  ];

  return (
    <Layout>
      <BigBodyCard>
        <DataTable
          title="Active Teams"
          defaultSortField="lastConnect"
          defaultSortAsc={false}
          columns={columns}
          data={teams}
        />
      </BigBodyCard>
    </Layout>
  );
});
