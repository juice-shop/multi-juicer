const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { get, extractTeamName } = require('./config');
const { logger } = require('./logger');

const app = express();

const teamRoutes = require('./teams/teams');
const adminRoutes = require('./admin/admin');
const proxyRoutes = require('./proxy/proxy');
//const scoreBoard = require('./score-board/score-board'); //the sscoreboard requires a progress watchdog in place

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
    k8s_env: process.env['K8S_ENV'],
    heroku_wrongsecret_ctf_url: process.env['REACT_APP_HEROKU_WRONGSECRETS_URL'],
    ctfd_url: process.env['REACT_APP_CTFD_URL'],
    s3_bucket_url: process.env['REACT_APP_S3_BUCKET_URL'],
    azure_blob_url: process.env['REACT_APP_AZ_BLOB_URL'],
    gcp_bucket_url: process.env['REACT_APP_GCP_BUCKET_URL'],
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
