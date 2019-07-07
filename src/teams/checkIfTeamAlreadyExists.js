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

  console.info(`Checking if team ${team} already has a JuiceShop Deployment`);

  try {
    const { body: deployment } = await getJuiceShopInstanceForTeamname(team);

    console.log(`Team ${team} already has a JuiceShop Deployment.`);

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
    if (
      error.response.body.message ===
      `deployments.apps "t-${team}-juiceshop" not found`
    ) {
      console.log(`Team ${team} doesn't have a JuiceShop Deployment yet.`);
      return next();
    } else {
      console.error(
        'encountered unkown error while checking for existing deployment'
      );
      console.error(error);
      return res.status(500).send(`Unkown error code: "${error.body.message}"`);
    }
  }
}

module.exports.checkIfTeamAlreadyExists = checkIfTeamAlreadyExists;
