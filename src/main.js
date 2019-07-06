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

app.use('/balancer', express.json());
app.use(cookieParser('askdbakhdajhvdsjavjdsgv'));

app.post('/balancer/teams/:team/join', checkIfTeamAlreadyExists, createTeam);
app.use('/balancer', express.static('public'));

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
      ws: true,
    },
    err => {
      console.error(`Failed to proxy request to ${req.url} with error: `, err);
    }
  );
});

app.listen(port, () => console.log(`JuiceBalancer listening on port ${port}!`));
