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
      console.log('adding timestamp to map');
      console.log({ team: teams[index], timeStamp });
      map.set(teams[index], timeStamp);
      return map;
    },
    new Map()
  );

  console.log({ teams, lastConnectTimestamps, timeStampsAsMap });

  const response = {
    instances: instances.map(instance => {
      const team = instance.metadata.labels.team;
      return {
        team,
        name: instance.metadata.name,
        ready: instance.status.availableReplicas === 1,
        createdAt: instance.metadata.creationTimestamp,
        lastConnect: timeStampsAsMap.get(team),
      };
    }),
  };

  console.log({ response });

  res.json(response);
}

router.get('/all', listInstances);
export default router;
