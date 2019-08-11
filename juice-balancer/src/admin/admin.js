const express = require('express');

const router = express.Router();

const { getJuiceShopInstances, deletePodForTeam } = require('../kubernetes');

const redis = require('../redis');
const { get } = require('../config');
const { logger } = require('../logger');

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function ensureAdminLogin(req, res, next) {
  logger.debug('Running admin check');
  if (req.teamname === `t-${get('admin.username')}`) {
    logger.debug('Admin check succeded');
    return next();
  }
  return res.status(401).send();
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function listInstances(req, res) {
  logger.debug('Running list all');
  const {
    body: { items: instances },
  } = await getJuiceShopInstances();

  const teams = instances.map(instance => instance.metadata.labels.team);
  const teamTimestampEntryName = teams.map(team => `t-${team}-last-request`);

  const lastConnectTimestamps = teams.length > 0 ? await redis.mget(teamTimestampEntryName) : [];
  const timeStampsAsMap = lastConnectTimestamps.reduce((map, timeStamp, index) => {
    map.set(teams[index], timeStamp);
    return map;
  }, new Map());

  return res.json({
    instances: instances.map(instance => {
      const team = instance.metadata.labels.team;
      return {
        team,
        name: instance.metadata.name,
        ready: instance.status.availableReplicas === 1,
        createdAt: instance.metadata.creationTimestamp.getTime(),
        lastConnect: parseInt(timeStampsAsMap.get(team), 10),
      };
    }),
  });
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function restartInstance(req, res) {
  try {
    const teamname = req.params.team;
    logger.info(`Deleting deployment for team: "${teamname}"`);

    await deletePodForTeam(teamname);

    res.send();
  } catch (error) {
    logger.error(error);
    res.status(500).send();
  }
}

router.all('*', ensureAdminLogin);
router.get('/all', listInstances);
router.post('/teams/:team/restart', restartInstance);
module.exports = router;
