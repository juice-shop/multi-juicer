const bcrypt = require('bcryptjs');

const redis = require('../redis');
const { getJuiceShopInstanceForTeamname } = require('../kubernetes/kubernetes');
/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function checkIfTeamAlreadyExists(req, res, next) {
  const { team } = req.params;
  const { passcode } = req.body;

  console.info('Checking if team already exists');

  try {
    console.info('Checking if deployment is there');

    const { body: deployment } = await getJuiceShopInstanceForTeamname(team);

    console.log('deployment');
    console.log({ deployment });

    const passcodeHash = await redis.get(`t-${team}-passcode`);

    if (passcode === undefined || bcrypt.compare(passcode, passcodeHash)) {
      return res.status(401).json({
        message: 'Team requires authentication to join.',
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
    console.warn('encountered error while checking for existing deployment');
    if (
      error.response.body.message ===
      `deployments.apps "t-${team}-juiceshop" not found`
    ) {
      return next();
    } else {
      console.error(error);
      return res.status(500).send(`Unkown error code: "${error.body.message}"`);
    }
  }
}

module.exports.checkIfTeamAlreadyExists = checkIfTeamAlreadyExists;
