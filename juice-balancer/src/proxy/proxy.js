import express from 'express';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer();

import redis from '../redis';
import config from '../config';

const router = express.Router();

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function redirectJuiceShopTrafficWithoutBalancerCookies(req, res, next) {
  if (req.signedCookies['balancer'] === undefined) {
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
  const teamname = req.signedCookies['balancer'];

  if (connectionCache.has(teamname)) {
    console.log('Has in Memory Connenction Cache for User');
    const timeDifference = currentTime - connectionCache.get('teamname');
    if (timeDifference < 10000) {
      console.log(
        `Time Difference > 10s: updating redis entry for "${teamname}-last-request"`
      );
      await redis.set(`${teamname}-last-request`, currentTime);
      connectionCache.set(teamname, currentTime);
    }
  } else {
    console.log(
      `No Entry: creating / updating redis entry for "${teamname}-last-request"`
    );
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
}

router.use(
  redirectJuiceShopTrafficWithoutBalancerCookies,
  updateLastConnectTimestamp,
  proxyTrafficToJuiceShop
);

export default router;
