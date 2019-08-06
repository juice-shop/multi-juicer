const express = require('express');
const cookieParser = require('cookie-parser');

const { get } = require('./config');

const app = express();

const teamRoutes = require('./teams/');
const adminRoutes = require('./admin/admin');
const proxyRoutes = require('./proxy/proxy');

app.use('/balancer', express.static(process.env['NODE_ENV'] === 'test' ? 'ui/build/' : 'public'));
app.use(cookieParser(get('cookieParser.secret')));
app.use('/balancer', express.json());

app.use((req, res, next) => {
  const teamname =
    process.env['NODE_ENV'] === 'test'
      ? req.cookies[get('cookieParser.cookieName')]
      : req.signedCookies[get('cookieParser.cookieName')];

  req.teamname = teamname;
  next();
});

app.use('/balancer/teams', teamRoutes);
app.use('/balancer/admin', adminRoutes);

app.use(proxyRoutes);

module.exports = app;
