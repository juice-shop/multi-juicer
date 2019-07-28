import React, { useEffect, useState } from 'react';
import { withRouter } from 'react-router-dom';
import axios from 'axios';

import { Layout } from '../Layout';

function fetchAdminData() {
  return axios.get(`/balancer/admin/all`).then(({ data }) => {
    return data;
  });
}

export const AdminPage = withRouter(() => {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { instances } = await fetchAdminData();
      setTeams(instances);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <Layout>
      <table>
        <thead>
          <td>Name</td>
          <td>Ready</td>
          <td>CreatedAt</td>
          <td>LastConnect</td>
        </thead>
        <tbody>
          {teams.map(team => {
            return (
              <tr key={team.name}>
                <td>{team.name}</td>
                <td>{team.ready ? '✅' : '❌'}</td>
                <td>{new Date(team.createdAt).toLocaleString()}</td>
                <td>{new Date(team.lastConnect).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Layout>
  );
});
