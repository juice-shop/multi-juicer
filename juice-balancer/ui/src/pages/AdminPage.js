import React, { useEffect, useState } from 'react';
import { withRouter } from 'react-router-dom';
import axios from 'axios';

import { Layout } from '../Layout';

export const AdminPage = withRouter(() => {
  let [teams, setTeams] = useState([]);

  useEffect(() => {
    axios
      .get(`/balancer/admin/all`)
      .then(({ data }) => {
        setTeams(data.instances);
      })
      .catch(() => {
        console.error('Failed to fetch current teams');
      });
  });

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
