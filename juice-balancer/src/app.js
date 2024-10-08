import express from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'path';

import { collectDefaultMetrics, register, Counter } from 'prom-client';
import basicAuth from 'basic-auth-connect';
import onFinished from 'on-finished';

import { get } from './config.js';

import teamRoutes from './teams/teams.js';
import adminRoutes from './admin/admin.js';
import proxyRoutes from './proxy/proxy.js';
import scoreBoard from './score-board/score-board.js';

const app = express();

if (get('metrics.enabled')) {
  collectDefaultMetrics();

  register.setDefaultLabels({ app: 'multijuicer' });

  const httpRequestsMetric = new Counter({
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
    async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (err) {
        console.error('Failed to write metrics', err);
        res.status(500).end();
      }
    }
  );
}

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
app.use(
  '/balancer/score-board/',
  express.static(process.env['NODE_ENV'] === 'test' ? 'ui/build/' : 'public')
);

app.use('/balancer/teams', teamRoutes);
app.get('/balancer/admin', (req, res) => {
  const indexFile = join(
    __dirname,
    process.env['NODE_ENV'] === 'test' ? '../ui/build/index.html' : '../public/index.html'
  );
  res.sendFile(indexFile);
});
app.use('/balancer/admin', adminRoutes);
app.use('/balancer/score-board', scoreBoard);

app.use(proxyRoutes);

export default app;
