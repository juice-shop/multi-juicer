const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const promClient = require('prom-client');
const basicAuth = require('basic-auth-connect');
const onFinished = require('on-finished');

const { get, extractTeamName } = require('./config');
const { logger } = require('./logger');

const app = express();

if (get('metrics.enabled')) {
  promClient.collectDefaultMetrics();

  promClient.register.setDefaultLabels({ app: 'wrongsecrets-ctf-party' });

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

  app.disable('x-powered-by');

  app.get(
    '/balancer/metrics',
    basicAuth(get('metrics.basicAuth.username'), get('metrics.basicAuth.password')),
    async (req, res) => {
      try {
        res.set('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
      } catch (err) {
        console.error('Failed to write metrics', err);
        res.status(500).end();
      }
    }
  );
}

const teamRoutes = require('./teams/teams');
const adminRoutes = require('./admin/admin');
const proxyRoutes = require('./proxy/proxy');
//const scoreBoard = require('./score-board/score-board');

app.get('/balancer/dynamics', (req, res) => {
  const accessPassword = process.env['REACT_APP_ACCESS_PASSWORD'];
  logger.info(`password: ${accessPassword}`);
  var usePassword = false;
  if (!accessPassword || accessPassword.length === 0) {
    //nothign for now
  } else {
    usePassword = true;
  }
  res.json({
    react_gif_logo: process.env['REACT_APP_MOVING_GIF_LOGO'],
    heroku_wrongsecret_ctf_url: process.env['REACT_APP_HEROKU_WRONGSECRETS_URL'],
    ctfd_url: process.env['REACT_APP_CTFD_URL'],
    s3_bucket_url: process.env['REACT_APP_S3_BUCKET_URL'],
    hmac_key: process.env['REACT_APP_CREATE_TEAM_HMAC_KEY'] || 'hardcodedkey',
    enable_password: usePassword,
  });
});

app.use(cookieParser(get('cookieParser.secret')));
app.use('/balancer', express.json());
app.use((req, res, next) => {
  const teamname = extractTeamName(req);

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
app.use(
  '/balancer/score-board/',
  express.static(process.env['NODE_ENV'] === 'test' ? 'ui/build/' : 'public')
);

app.use('/balancer/teams', teamRoutes);
app.get('/balancer/admin', (req, res) => {
  const indexFile = path.join(
    __dirname,
    process.env['NODE_ENV'] === 'test' ? '../ui/build/index.html' : '../public/index.html'
  );
  res.sendFile(indexFile);
});
app.use('/balancer/admin', adminRoutes);
//app.use('/balancer/score-board', scoreBoard);

app.use(proxyRoutes);

module.exports = app;
