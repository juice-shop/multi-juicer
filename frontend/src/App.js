import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [joined, setJoined] = useState(null);
  const [teamname, setTeamname] = useState('');

  const passcode = undefined;

  async function sendJoinRequest() {
    try {
      const { data } = await axios.post(`/balancer/teams/${teamname}/join`, {
        passcode,
      });

      console.log('got data back');
      console.log(data);

      setJoined(true);
    } catch (err) {
      console.error(err);
      setJoined(false);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendJoinRequest({ teamname });
  }

  return (
    <>
      <h1>JuiceBalancer 🎉🎢🚀</h1>
      <form onSubmit={onSubmit}>
        <label>
          Teamname:
          <input
            type="text"
            name="teamname"
            value={teamname}
            onChange={({ target }) => setTeamname(target.value)}
          />
        </label>
        <button type="submit">Join</button>
      </form>
      {joined === true ? <span>Joined!</span> : null}
      {joined === false ? <span>Failed to Join!</span> : null}
      {joined === null ? <span>Nothing yet</span> : null}
    </>
  );
}

export default App;
