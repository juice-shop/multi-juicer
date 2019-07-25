import express from 'express';
import bcrypt from 'bcryptjs';
import cryptoRandomString from 'crypto-random-string';

import Joi from '@hapi/joi';
import expressJoiValidation from 'express-joi-validation';

const validator = expressJoiValidation.createValidator();

const router = express.Router();

import redis from '../redis';
import {
  createDeploymentForTeam,
  createServiceForTeam,
  getJuiceShopInstanceForTeamname,
} from '../kubernetes/kubernetes';
import { logger } from '../logger';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
        .cookie('balancer', `t-${team}`, {
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
 */
async function createTeam(req, res) {
  const { team } = req.params;
  try {
    const passcode = cryptoRandomString({ length: 8 }).toUpperCase();
    const hash = await bcrypt.hash(passcode, 12);

    await redis.set(`t-${team}-passcode`, hash);
    await redis.set(`t-${team}-last-request`, new Date().getDate());

    logger.info(`Creating JuiceShop Deployment for team "${team}"`);

    await createDeploymentForTeam({ team, passcode });
    await createServiceForTeam(team);

    logger.info(`Created JuiceShop Deployment for team "${team}"`);

    res
      .cookie('balancer', `t-${team}`, {
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
      const { body } = await getJuiceShopInstanceForTeamname(team);
      const { readyReplicas } = body.status;

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
    .alphanum()
    .max(16),
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
  checkIfTeamAlreadyExists,
  createTeam
);

router.get('/:team/wait-till-ready', validator.params(paramsSchema), awaitReadyness);

export default router;
