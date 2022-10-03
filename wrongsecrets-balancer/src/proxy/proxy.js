const express = require('express');
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer();
const cookieParser = require('cookie-parser');

const { get, extractTeamName } = require('../config');
const { logger } = require('../logger');
const {
  getJuiceShopInstanceForTeamname,
  updateLastRequestTimestampForTeam,
} = require('../kubernetes');

const router = express.Router();

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function redirectJuiceShopTrafficWithoutBalancerCookies(req, res, next) {
  if (!req.teamname) {
    logger.debug('Got request without team cookie in proxy. Redirecting to /balancer/');
    return res.redirect('/balancer/');
  }
  return next();
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function redirectAdminTrafficToBalancerPage(req, res, next) {
  if (req.teamname === `t-${get('admin.username')}`) {
    logger.debug('Got admin request in proxy. Redirecting to /balancer/');
    return res.redirect('/balancer/?msg=logged-as-admin');
  }
  return next();
}

const connectionCache = new Map();

/**
 * Checks at most every 10sec if the deployment the traffic should go to is ready.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function checkIfInstanceIsUp(req, res, next) {
  const teamname = req.cleanedTeamname;

  const currentTime = new Date().getTime();
  if (connectionCache.has(teamname) && currentTime - connectionCache.get(teamname) < 10000) {
    return next();
  }

  try {
    const { readyReplicas } = await getJuiceShopInstanceForTeamname(teamname);

    if (readyReplicas === 1) {
      return next();
    }

    logger.warn(`Tried to proxy for team ${teamname}, but no ready instance found.`);
    return res.redirect(`/balancer/?msg=instance-restarting&teamname=${teamname}`);
  } catch (error) {
    logger.warn(`Could not find instance for team: '${teamname}'`);
    res.redirect(`/balancer/?msg=instance-not-found&teamname=${teamname}`);
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function updateLastConnectTimestamp(req, res, next) {
  const currentTime = new Date().getTime();
  const teamname = req.cleanedTeamname;

  try {
    if (connectionCache.has(teamname)) {
      const timeDifference = currentTime - connectionCache.get(teamname);
      if (timeDifference > 10000) {
        connectionCache.set(teamname, currentTime);
        await updateLastRequestTimestampForTeam(teamname);
      }
    } else {
      await updateLastRequestTimestampForTeam(teamname);
      connectionCache.set(teamname, currentTime);
    }
  } catch (error) {
    logger.warn(`Failed to update lastRequest timestamp for team '${teamname}'"`);
    logger.warn(error.message);
    logger.warn(JSON.stringify(error));
  }
  next();
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function proxyTrafficToJuiceShop(req, res) {
  const teamname = req.teamname;
  const regex = new RegExp('^[a-z0-9]([-a-z0-9])+[a-z0-9]$', 'i');
  if (!regex.test(teamname)) {
    logger.info(`Got malformed teamname: ${teamname}s`);
    return res.redirect('/balancer/');
  }
  const currentReferrerForDesktop = '/?desktop';
  logger.debug(
    `Proxying request ${req.method.toLocaleUpperCase()} ${
      req.path
    } with matcher for referer: ${currentReferrerForDesktop}`
  );
  let target;
  if (
    (req.query != null && req.query.desktop != null) ||
    (req.headers['referer'] !== undefined &&
      req.headers['referer'].includes(currentReferrerForDesktop)) ||
    (req.headers['Referer'] !== undefined &&
      req.headers['Referer'].includes(currentReferrerForDesktop)) ||
    req.path === '/js/filebrowser.js' ||
    req.path === '/css/filebrowser.css' ||
    req.path === '/files/socket.io/socket.io.js' ||
    req.path === '/js/vendor/jquery.min.js' ||
    req.path === '/files/socket.io/' ||
    req.path === '/files/socket.io/socket.io.js.map'
  ) {
    target = {
      target: `http://${teamname}-virtualdesktop.${teamname}.svc:8080`,
      ws: true,
    };
  } else {
    target = {
      target: `http://${teamname}-wrongsecrets.${teamname}.svc:8080`,
      ws: true,
    };
  }
  logger.info(`we got ${teamname} requesting ${target.target}`);

  if (req.path === '/guaclite') {
    let server = res.socket.server;
    logger.info('putting ws through for /quaclite');
    server.on('upgrade', function (req, socket, head) {
      cookieParser(get('cookieParser.secret'))(req, null, () => {});

      // logger.info(
      //   `we have cookies: ${JSON.stringify(req.cookies)} and  ${JSON.stringify(req.signedCookies)}`
      // );
      const upgradeTeamname = extractTeamName(req);
      logger.info(`proxying upgrade request for: ${req.url} with team ${upgradeTeamname}`);
      proxy.ws(req, socket, head, {
        target: `ws://${upgradeTeamname}-virtualdesktop.${upgradeTeamname}.svc:8080`,
        ws: true,
      });
    });
    server.on('connect', function (req, socket, head) {
      const connectTeamname = extractTeamName(req);
      const regex = new RegExp('^[a-z0-9]([-a-z0-9])+[a-z0-9]$', 'i');
      if (!regex.test(connectTeamname)) {
        logger.info(`Got malformed teamname: ${teamname}s`);
        return res.redirect('/balancer/');
      }
      logger.info(`proxying upgrade request for: ${req.url} with team ${connectTeamname}`);
      proxy.ws(req, socket, head, {
        target: `ws://${connectTeamname}-virtualdesktop.${connectTeamname}.svc:8080`,
        ws: true,
      });
    });
  } else {
    proxy.web(req, res, target, (error) => {
      logger.warn(`Proxy fail '${error.code}' for: ${req.method.toLocaleUpperCase()} ${req.path}`);

      if (error.code !== 'ENOTFOUND' && error.code !== 'EHOSTUNREACH') {
        logger.error(error.message);
      } else {
        logger.debug(error.message);
      }
    });
  }
}

router.use(
  redirectJuiceShopTrafficWithoutBalancerCookies,
  redirectAdminTrafficToBalancerPage,
  checkIfInstanceIsUp,
  updateLastConnectTimestamp,
  proxyTrafficToJuiceShop
);

module.exports = router;
