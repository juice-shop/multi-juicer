const bcrypt = require('bcryptjs');
const cryptoRandomString = require('crypto-random-string');

const redis = require('../redis');
const {
  createDeploymentForTeam,
  createServiceForTeam,
  getJuiceShopInstanceForTeamname,
} = require('../kubernetes/kubernetes');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const createPasscode = async () => {
  const passcode = cryptoRandomString({ length: 8 }).toUpperCase();
  const hash = await bcrypt.hash(passcode, 12);

  return {
    passcode,
    passcodeHash: hash,
  };
};

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function createTeam(req, res, next) {
  try {
    const { team } = req.params;

    const { passcode, passcodeHash } = await createPasscode();
    await redis.set(`t-${team}-passcode`, passcodeHash);

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

module.exports.createTeam = createTeam;
