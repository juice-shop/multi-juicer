const express = require('express');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer();

const redis = require('../redis');
const { get } = require('../config');
const { logger } = require('../logger');

const router = express.Router();

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function redirectJuiceShopTrafficWithoutBalancerCookies(req, res, next) {
  if (req.signedCookies[get('cookieParser.cookieName')] === undefined) {
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
  if (req.signedCookies[get('cookieParser.cookieName')] === `t-${get('admin.username')}`) {
    return res.redirect('/balancer/');
  }
  return next();
}

const connectionCache = new Map();

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function updateLastConnectTimestamp(req, res, next) {
  const currentTime = new Date().getTime();
  const teamname = req.signedCookies[get('cookieParser.cookieName')];

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
  const teamname = req.signedCookies[get('cookieParser.cookieName')];
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
  updateLastConnectTimestamp,
  proxyTrafficToJuiceShop
);

module.exports = router;
