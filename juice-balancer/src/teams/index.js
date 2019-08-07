const express = require('express');
const bcrypt = require('bcryptjs');
const cryptoRandomString = require('crypto-random-string');

const Joi = require('@hapi/joi');
const expressJoiValidation = require('express-joi-validation');

const validator = expressJoiValidation.createValidator();

const router = express.Router();

const redis = require('../redis');
const {
  createDeploymentForTeam,
  createServiceForTeam,
  getJuiceShopInstanceForTeamname,
  getJuiceShopInstances,
} = require('../kubernetes/kubernetes');
const { logger } = require('../logger');
const { get } = require('../config');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function interceptAdminLogin(req, res, next) {
  const { team } = req.params;
  const { passcode } = req.body;

  logger.debug(
    `Checking if team "${team}:${passcode}" is the admin "${get('admin.username')}:${get(
      'admin.password'
    )}"`
  );

  if (team === get('admin.username') && passcode === get('admin.password')) {
    return res
      .cookie(get('cookieParser.cookieName'), `t-${team}`, {
        signed: true,
        httpOnly: true,
      })
      .json({
        message: 'Signed in as admin',
      });
  } else if (team === get('admin.username')) {
    return res.status(401).json({
      message: 'Team requires authentication to join',
    });
  }

  return next();
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function checkIfTeamAlreadyExists(req, res, next) {
  const { team } = req.params;
  const { passcode } = req.body;

  logger.info(`Checking if team ${team} already has a JuiceShop Deployment`);

  try {
    await getJuiceShopInstanceForTeamname(team);

    logger.info(`Team ${team} already has a JuiceShop deployment`);

    const passcodeHash = await redis.get(`t-${team}-passcode`);

    if (passcode !== undefined && (await bcrypt.compare(passcode, passcodeHash))) {
      // Set cookie, (join team)
      return res
        .cookie(get('cookieParser.cookieName'), `t-${team}`, {
          signed: true,
          httpOnly: true,
        })
        .status(200)
        .send();
    }

    return res.status(401).json({
      message: 'Team requires authentication to join',
    });
  } catch (error) {
    if (error.response.body.message === `deployments.apps "t-${team}-juiceshop" not found`) {
      logger.info(`Team ${team} doesn't have a JuiceShop deployment yet`);
      return next();
    } else {
      logger.error('Encountered unkown error while checking for existing JuiceShop deployment');
      logger.error(error);
      return res.status(500).send(`Unkown error code: "${error.body.message}"`);
    }
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function checkIfMaxJuiceShopInstancesIsReached(req, res, next) {
  const maxInstances = get('maxJuiceShopInstances');

  // If max instances is set to negative numbers it's not capped
  if (maxInstances < 0) {
    logger.debug(`Skipping max instance check, max instances is set to "${maxInstances}"`);
    return next();
  }

  try {
    const response = await getJuiceShopInstances();

    const instances = response.body.items;

    logger.info(`Reached ${instances.length}/${maxInstances} instances`);
    if (instances.length >= maxInstances) {
      logger.error('Max instance count reached');
      return res.status(500).send('Reached Maximum Instance Count. Find a Admin to handle this.');
    }
    next();
  } catch (error) {
    logger.error('Failed to check max instances');
    logger.error(error.message);
    next();
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function createTeam(req, res) {
  const { team } = req.params;
  try {
    const passcode = cryptoRandomString({ length: 8 }).toUpperCase();
    const hash = await bcrypt.hash(passcode, 12);

    await redis.set(`t-${team}-passcode`, hash);
    await redis.set(`t-${team}-last-request`, new Date().getTime());

    logger.info(`Creating JuiceShop Deployment for team "${team}"`);

    await createDeploymentForTeam({ team, passcode });
    await createServiceForTeam(team);

    logger.info(`Created JuiceShop Deployment for team "${team}"`);

    res
      .cookie(get('cookieParser.cookieName'), `t-${team}`, {
        signed: true,
        httpOnly: true,
      })
      .status(200)
      .json({
        message: 'Created Instance',
        passcode,
      });
  } catch (error) {
    logger.error(`Error while creating deployment or service for team ${team}`);
    logger.error(error);
    res.status(500).send();
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function awaitReadyness(req, res) {
  const { team } = req.params;

  logger.info(`Awaiting readyness of JuiceShop Deployment for team "${team}"`);

  try {
    for (let i = 0; i < 180; i++) {
      const { readyReplicas } = await getJuiceShopInstanceForTeamname(team);

      if (readyReplicas === 1) {
        logger.info(`JuiceShop Deployment for team "${team} ready"`);

        return res.status(200).send();
      }

      await sleep(1000);
    }

    logger.error(`Waiting for deployment of team "${team}" timed out`);
    res.status(500);
  } catch (error) {
    logger.error(`Failed to wait for teams "${team}" deployment to get ready`);
    logger.error(error);
    res.status(500);
  }
}

const paramsSchema = Joi.object({
  team: Joi.string()
    .required()
    .max(16)
    .regex(/^[a-z0-9]([-a-z0-9])+[a-z0-9]$/),
});
const bodySchema = Joi.object({
  passcode: Joi.string()
    .optional()
    .alphanum()
    .uppercase()
    .length(8),
});

router.post(
  '/:team/join',
  validator.params(paramsSchema),
  validator.body(bodySchema),
  interceptAdminLogin,
  checkIfTeamAlreadyExists,
  checkIfMaxJuiceShopInstancesIsReached,
  createTeam
);

router.get('/:team/wait-till-ready', validator.params(paramsSchema), awaitReadyness);

module.exports = router;
