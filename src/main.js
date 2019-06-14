const express = require('express');
const cookieParser = require('cookie-parser');

const {
  checkIfTeamAlreadyExists,
} = require('./teams/checkIfTeamAlreadyExists');
const { createTeam } = require('./teams/createTeam');

const app = express();
const port = 3000;

app.use(express.json());
app.use(cookieParser('askdbakhdajhvdsjavjdsgv'));

app.get('/balancer/', (req, res) => res.send('JuiceBalancer 🎉🎢🚀'));

app.post('/balancer/teams/:team/join', checkIfTeamAlreadyExists, createTeam);

// Redirect users without a balancer token to the start page
app.use((req, res) => {
  if (req.signedCookies['balancer'] === undefined) {
    res.redirect('/balancer/');
  }
});

app.listen(port, () => console.log(`JuiceBalancer listening on port ${port}!`));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
