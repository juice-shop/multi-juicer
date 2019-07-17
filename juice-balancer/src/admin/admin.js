import express from 'express';

const router = express.Router();

import { getJuiceShopInstances } from '../kubernetes/kubernetes';

import redis from '../redis';

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function listInstances(req, res, next) {
  const {
    body: { items: instances },
  } = await getJuiceShopInstances();

  const teams = instances.map(instance => instance.metadata.labels.team);
  const teamTimestampEntryName = teams.map(team => `t-${team}-last-request`);

  const lastConnectTimestamps = await redis.mget(teamTimestampEntryName);
  const timeStampsAsMap = lastConnectTimestamps.reduce(
    (map, timeStamp, index) => {
      map.set(teams[index], timeStamp);
      return map;
    },
    new Map()
  );

  return res.json({
    instances: instances.map(instance => {
      const team = instance.metadata.labels.team;
      return {
        team,
        name: instance.metadata.name,
        ready: instance.status.availableReplicas === 1,
        createdAt: instance.metadata.creationTimestamp.getTime(),
        lastConnect: timeStampsAsMap.get(team),
      };
    }),
  });
}

router.get('/all', listInstances);
export default router;
