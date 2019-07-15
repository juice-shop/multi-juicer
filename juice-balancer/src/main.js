const express = require('express');
const cookieParser = require('cookie-parser');
const httpProxy = require('http-proxy');
const config = require('./config');

const app = express();

const proxy = httpProxy.createProxyServer();

const teamRoutes = require('./teams/');

app.use('/balancer', express.static('public'));
app.use(cookieParser(config.cookieParser.secret));
app.use('/balancer', express.json());

app.use('/balancer/teams', teamRoutes);

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
      target: `http://${teamname}-juiceshop.${config.namespace}.svc:3000`,
      ws: true,
    },
    err => {
      console.error(
        `PROXY_FAIL: ${req.method.toLocaleUpperCase()} ${req.path}`
      );
    }
  );
});

app.listen(config.port, () =>
  console.log(`JuiceBalancer listening on port ${config.port}!`)
);
