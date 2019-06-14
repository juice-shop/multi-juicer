const bcrypt = require('bcryptjs');
const cryptoRandomString = require('crypto-random-string');
const {
  createDeploymentForTeam,
  createServiceForTeam,
  getJuiceShopInstanceForTeamname,
} = require('../kubernetes/kubernetes');

const createPasscode = async () => {
  const passcode = cryptoRandomString({ length: 6 }).toUpperCase();

  return {
    passcode,
    passcodeHash: await bcrypt.hash(passcode),
  };
};

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function createTeam(req, res, next) {
  const { team } = req.params;

  const { passcode, passcodeHash } = await createPasscode();

  const startTime = new Date();
  await createDeploymentForTeam({ team, passcodeHash });

  for (const _ of Array.from({ length: 100 })) {
    const res = await getJuiceShopInstanceForTeamname(team);

    if (res.body.status.availableReplicas === 1) {
      break;
    }

    await sleep(250);
  }

  const endTime = new Date();
  const differenceMs = endTime.getTime() - startTime.getTime();

  await createServiceForTeam(team);

  console.log(
    `Started JuiceShop Instance for "${team}". StartUp Time: ${differenceMs.toLocaleString()}ms`
  );

  res.json({
    message: 'Create Instance.',
    passcode,
  });
}

module.exports.createTeam = createTeam;
