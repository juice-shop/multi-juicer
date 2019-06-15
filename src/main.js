const express = require('express');
const cookieParser = require('cookie-parser');
const httpProxy = require('http-proxy');

const app = express();
const port = 3000;

const proxy = httpProxy.createProxyServer();

const {
  checkIfTeamAlreadyExists,
} = require('./teams/checkIfTeamAlreadyExists');
const { createTeam } = require('./teams/createTeam');

app.use(express.json());
app.use(cookieParser('askdbakhdajhvdsjavjdsgv'));

app.get('/balancer/', (req, res) => res.send(`<h1>JuiceBalancer 🎉🎢🚀</h1>`));

app.post('/balancer/teams/:team/join', checkIfTeamAlreadyExists, createTeam);

// Redirect users without a balancer token to the start page
app.use((req, res, next) => {
  if (req.signedCookies['balancer'] === undefined) {
    return res.redirect('/balancer/');
  }
  return next();
});

app.use((req, res) => {
  const teamname = req.signedCookies['balancer'];

  proxy.web(
    req,
    res,
    {
      target: `http://${teamname}-juiceshop.default.svc:3000`,
    },
    err => {
      console.error(`Failed to proxy request to ${req.url} with error: `, err);
    }
  );
});

app.listen(port, () => console.log(`JuiceBalancer listening on port ${port}!`));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
