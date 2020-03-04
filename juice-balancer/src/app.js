const express = require('express');
const cookieParser = require('cookie-parser');

const promClient = require('prom-client');
const basicAuth = require('basic-auth-connect');
const onFinished = require('on-finished');

const { get } = require('./config');

const app = express();

if (get('metrics.enabled')) {
  promClient.collectDefaultMetrics();

  promClient.register.setDefaultLabels({ app: 'multijuicer' });

  const httpRequestsMetric = new promClient.Counter({
    name: 'http_requests_count',
    help: 'Total HTTP request count grouped by status code.',
    labelNames: ['status_code'],
  });

  app.use((req, res, next) => {
    onFinished(res, () => {
      const statusCode = `${Math.floor(res.statusCode / 100)}XX`;
      httpRequestsMetric.labels(statusCode).inc();
    });
    next();
  });

  app.get(
    '/balancer/metrics',
    basicAuth(get('metrics.basicAuth.username'), get('metrics.basicAuth.password')),
    (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      res.end(promClient.register.metrics());
    }
  );
}

const teamRoutes = require('./teams/teams');
const adminRoutes = require('./admin/admin');
const proxyRoutes = require('./proxy/proxy');

app.use(cookieParser(get('cookieParser.secret')));
app.use('/balancer', express.json());
app.use((req, res, next) => {
  const teamname =
    process.env['NODE_ENV'] === 'test'
      ? req.cookies[get('cookieParser.cookieName')]
      : req.signedCookies[get('cookieParser.cookieName')];

  req.teamname = teamname;
  if (teamname) {
    // Omit the initial "t-" part. Example 't-team42' => 'team42'
    req.cleanedTeamname = teamname.substring(2);
  }
  next();
});

app.get('/balancer/', (req, res, next) => {
  if (req.query['teamname']) {
    return next();
  }
  if (!req.teamname) {
    return next();
  }
  return res.redirect(`/balancer/?msg=logged-in&teamname=${req.cleanedTeamname}`);
});

app.use('/balancer', express.static(process.env['NODE_ENV'] === 'test' ? 'ui/build/' : 'public'));

app.use('/balancer/teams', teamRoutes);
app.use('/balancer/admin', adminRoutes);

app.use(proxyRoutes);

module.exports = app;
