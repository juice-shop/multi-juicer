const express = require('express');
const bcrypt = require('bcryptjs');
const cryptoRandomString = require('crypto-random-string');

const router = express.Router();

const redis = require('../redis');
const {
  createDeploymentForTeam,
  createServiceForTeam,
  getJuiceShopInstanceForTeamname,
} = require('../kubernetes/kubernetes');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function checkIfTeamAlreadyExists(req, res, next) {
  const { team } = req.params;
  const { passcode } = req.body;

  console.info(`Checking if team ${team} already has a JuiceShop Deployment`);

  try {
    await getJuiceShopInstanceForTeamname(team);

    console.log(`Team ${team} already has a JuiceShop deployment`);

    const passcodeHash = await redis.get(`t-${team}-passcode`);

    if (passcode === undefined || bcrypt.compare(passcode, passcodeHash)) {
      return res.status(401).json({
        message: 'Team requires authentication to join',
      });
    }

    // Set cookie, (join team)
    res
      .cookie('balancer', `t-${team}`, {
        signed: true,
        httpOnly: true,
      })
      .status(200)
      .send();
  } catch (error) {
    if (
      error.response.body.message ===
      `deployments.apps "t-${team}-juiceshop" not found`
    ) {
      console.log(`Team ${team} doesn't have a JuiceShop deployment yet`);
      return next();
    } else {
      console.error(
        'Encountered unkown error while checking for existing JuiceShop deployment'
      );
      console.error(error);
      return res.status(500).send(`Unkown error code: "${error.body.message}"`);
    }
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function createTeam(req, res, next) {
  try {
    const { team } = req.params;

    const passcode = cryptoRandomString({ length: 8 }).toUpperCase();
    const hash = await bcrypt.hash(passcode, 12);

    await redis.set(`t-${team}-passcode`, hash);

    const startTime = new Date();
    await createDeploymentForTeam({ team, passcode });

    console.info(`Creating JuiceShop Deployment for team ${team}`);

    for (const _ of Array.from({ length: 100 })) {
      const res = await getJuiceShopInstanceForTeamname(team);
      const { readyReplicas } = res.body.status;

      if (readyReplicas === 1) {
        break;
      }

      await sleep(250);
    }

    const endTime = new Date();
    const differenceMs = endTime.getTime() - startTime.getTime();

    await createServiceForTeam(team);

    console.log(
      `Created JuiceShop Deployment for "${team}". StartUp Time: ${differenceMs.toLocaleString()}ms`
    );

    res
      .cookie('balancer', `t-${team}`, {
        signed: true,
        httpOnly: true,
      })
      .status(200)
      .json({
        message: 'Create Instance.',
        passcode,
      });
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
}

router.post('/:team/join', checkIfTeamAlreadyExists, createTeam);

module.exports = router;
