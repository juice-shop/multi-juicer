const { getJuiceShopInstanceForTeamname } = require('../kubernetes/kubernetes');

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function checkIfTeamAlreadyExists(req, res, next) {
  const { team } = req.params;
  try {
    const { body: deployment } = await getJuiceShopInstanceForTeamname(team);

    return res.status(401).json({
      message: 'Team requires authentication to join.',
    });
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
