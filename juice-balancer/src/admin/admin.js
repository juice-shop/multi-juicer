import { Router } from 'express';

const router = Router();

import {
  getJuiceShopInstances,
  deletePodForTeam,
  deleteDeploymentForTeam,
  deleteServiceForTeam,
} from '../kubernetes.js';
import { get } from '../config.js';
import { logger } from '../logger.js';

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function ensureAdminLogin(req, res, next) {
  logger.debug('Running admin check');
  if (req.teamname === `t-${get('admin.username')}`) {
    logger.debug('Admin check succeeded');
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

  return res.json({
    instances: instances.map((instance) => {
      const team = instance.metadata.labels.team;
      return {
        team,
        name: instance.metadata.name,
        ready: instance.status.availableReplicas === 1,
        createdAt: instance.metadata.creationTimestamp.getTime(),
        lastConnect: parseInt(
          instance.metadata.annotations['multi-juicer.owasp-juice.shop/lastRequest'],
          10
        ),
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
    logger.info(`Restarting deployment for team: '${teamname}'`);

    await deletePodForTeam(teamname);

    res.send();
  } catch (error) {
    logger.error(error);
    res.status(500).send();
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function deleteInstance(req, res) {
  try {
    const teamname = req.params.team;
    logger.info(`Deleting deployment for team: '${teamname}'`);

    await deleteDeploymentForTeam(teamname);
    await deleteServiceForTeam(teamname);

    res.send();
  } catch (error) {
    logger.error(error);
    res.status(500).send();
  }
}

router.all('*', ensureAdminLogin);
router.get('/all', listInstances);
router.post('/teams/:team/restart', restartInstance);
router.delete('/teams/:team/delete', deleteInstance);

export default router;
