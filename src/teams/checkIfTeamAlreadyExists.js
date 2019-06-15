const { getJuiceShopInstanceForTeamname } = require('../kubernetes/kubernetes');
const bcrypt = require('bcryptjs');
/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function checkIfTeamAlreadyExists(req, res, next) {
  const { team } = req.params;
  const { passcode } = req.body;

  try {
    const { body: deployment } = await getJuiceShopInstanceForTeamname(team);

    const { passcode: passcodeHash } = deployment.metadata.labels;

    if (
      passcode === undefined ||
      !(await bcrypt.compare(passcode, passcodeHash))
    ) {
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
      return next();
    } else {
      console.error(error);
      return res.status(500).send(`Unkown error code: "${error.body.message}"`);
    }
  }
}

module.exports.checkIfTeamAlreadyExists = checkIfTeamAlreadyExists;
