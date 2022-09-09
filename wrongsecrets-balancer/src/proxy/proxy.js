const express = require('express');
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer();

const { get } = require('../config');
const { logger } = require('../logger');
const {
  getJuiceShopInstanceForTeamname,
  updateLastRequestTimestampForTeam,
} = require('../kubernetes');
const { createProxyMiddleware } = require('http-proxy-middleware');

//
// server.on('upgrade', function (req, socket, head) {
//   logger.info('proxying upgrade request for: ' + req.url);
//   proxy.ws(req, socket, head, {
//     target: `http://${req.teamname}-virtualdesktop.${get('namespace')}.svc:8080`,
//     ws: true,
//   });
// });
// server.on('connect', function (req, socket, head) {
//   logger.info('proxying connect request for: ' + req.url);
//   proxy.ws(req, socket, head, {
//     target: `http://${req.teamname}-virtualdesktop.${get('namespace')}.svc:8080`,
//     ws: true,
//   });
// });

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
  const currentReferrerForDesktop = 'http://' + req.host + ':' + 3000 + '/?desktop';
  logger.debug(`Proxying request ${req.method.toLocaleUpperCase()} ${req.path} with matcher for referer: ${currentReferrerForDesktop}`);
  let target;
  if (
    (req.query != null && req.query.desktop != null) ||
    (req.headers['referer'] !== undefined &&
      req.headers['referer'] === currentReferrerForDesktop) ||
    (req.headers['Referer'] !== undefined &&
      req.headers['Referer'] === currentReferrerForDesktop) ||
    req.path === '/js/filebrowser.js' ||
    req.path === '/css/filebrowser.css' ||
    req.path === '/files/socket.io/socket.io.js' ||
    req.path === '/js/vendor/jquery.min.js' ||
    req.path === '/files/socket.io/' ||
    req.path === '/files/socket.io/socket.io.js.map'
  ) {
    // req.path === '/css/keyboard.svg' ||
    //   req.path === '/css/vdi.css' ||
    //   req.path === '/css/fit.svg' ||
    //   req.path === '/css/fullscreen.svg' ||
    //   // req.path === '/favicon.ico' ||
    //   req.path === '/css/files.svg' ||
    //   req.path === '/js/vendor/guac.min.js' ||
    //   req.path === '/js/rdp.js' ||
    //   req.path === '/files' ||
    //   req.path === '/js/filebrowser.js' ||
    //   req.path === '/css/filebrowser.css' ||
    //   req.path === '/files/socket.io/socket.io.js' ||
    //   req.path === '/files/socket.io/' ||
    //   req.path === '/files/socket.io/socket.io.js.map' ||
    //
    logger.info('we have a desktop entry for team ' + teamname);
    target = {
      target: `http://${teamname}-virtualdesktop.${get('namespace')}.svc:8080`,
      ws: true,
    };
  } else {
    target = {
      target: `http://${teamname}-wrongsecrets.${get('namespace')}.svc:8080`,
      ws: true,
    };
  }
  logger.info(target.target);

  if (req.path === '/guaclite') {
    server = res.connection.server;
    logger.info('putting ws through for /quaclite');
    server.on('upgrade', function (req, socket, head) {
      logger.info('proxying upgrade request for: ' + req.url);
      proxy.ws(req, socket, head, {
        target: `ws://${teamname}-virtualdesktop.${get('namespace')}.svc:8080`,
        ws: true,
      });
    });
    server.on('connect', function (req, socket, head) {
      logger.info('proxying connect request for: ' + req.url);
      proxy.ws(req, socket, head, {
        target: `ws://${teamname}-virtualdesktop.${get('namespace')}.svc:8080`,
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

// const magic = createProxyMiddleware({
//   router: function (req) {
//     logger.info('Entering router for req' + req.path);
//     const teamname = req.teamname;
//     const currentReferrerForDesktop = 'http://' + req.hostname + ':' + 3000 + '/?desktop';
//     if (req.path === '/guaclite') {
//       return `ws://${teamname}-virtualdesktop.default.svc:8080`;
//     } else if (
//       (req.query != null && req.query.desktop != null) ||
//       (req.headers['referer'] !== undefined &&
//         req.headers['referer'] === currentReferrerForDesktop) ||
//       (req.headers['Referer'] !== undefined &&
//         req.headers['Referer'] === currentReferrerForDesktop) ||
//       req.path === '/js/filebrowser.js' ||
//       req.path === '/css/filebrowser.css' ||
//       req.path === '/files/socket.io/socket.io.js' ||
//       req.path === '/js/vendor/jquery.min.js' ||
//       req.path === '/files/socket.io/' ||
//       req.path === '/files/socket.io/socket.io.js.map'
//     ) {
//       return `http://${teamname}-virtualdesktop.default.svc:8080`;
//     }

//     return `http://${teamname}-wrongsecrets.default.svc:8080`;
//   },
// });

router.use(
  redirectJuiceShopTrafficWithoutBalancerCookies,
  redirectAdminTrafficToBalancerPage,
  checkIfInstanceIsUp,
  updateLastConnectTimestamp,
  proxyTrafficToJuiceShop
);

module.exports = router;
