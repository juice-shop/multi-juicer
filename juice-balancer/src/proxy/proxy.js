const express = require('express');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer();

const redis = require('../redis');
const { get } = require('../config');
const { logger } = require('../logger');
const { getJuiceShopInstanceForTeamname } = require('../kubernetes');

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
  const teamname = req.teamname;

  if (connectionCache.has(teamname)) {
    const timeDifference = currentTime - connectionCache.get(teamname);
    if (timeDifference > 10000) {
      await redis.set(`${teamname}-last-request`, currentTime);
      connectionCache.set(teamname, currentTime);
    }
  } else {
    await redis.set(`${teamname}-last-request`, currentTime);
    connectionCache.set(teamname, currentTime);
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
  logger.debug(`Proxing request ${req.method.toLocaleUpperCase()} ${req.path}`);

  proxy.web(
    req,
    res,
    {
      target: `http://${teamname}-juiceshop.${get('namespace')}.svc:3000`,
      ws: true,
    },
    error => {
      logger.warn(`Proxy fail "${error.code}" for: ${req.method.toLocaleUpperCase()} ${req.path}`);

      if (error.code !== 'ENOTFOUND' && error.code !== 'EHOSTUNREACH') {
        logger.error(error.message);
      } else {
        logger.debug(error.message);
      }
    }
  );
}

router.use(
  redirectJuiceShopTrafficWithoutBalancerCookies,
  redirectAdminTrafficToBalancerPage,
  checkIfInstanceIsUp,
  updateLastConnectTimestamp,
  proxyTrafficToJuiceShop
);

module.exports = router;
