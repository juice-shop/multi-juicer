const express = require('express');

const router = express.Router();

const { getJuiceShopInstances } = require('../kubernetes');
const { logger } = require('../logger');

// Generated via curl https://wrongsecrets-ctf.herokuapp.com/api/challenges | jq '.data | map({ key: .key, value: .difficulty }) | from_entries'
const keyDifficultyMapping = Object.freeze({
  challenge1: 1,
  challenge2: 1,
  challenge3: 1,
  challenge4: 2,
  challenge5: 2,
  challenge6: 2,
  challenge7: 4,
  challenge8: 2,
  challenge9: 3,
  challenge10: 4,
  challenge11: 4,
  challenge12: 3,
  challenge13: 3,
  challenge14: 4,
  challenge15: 2,
  challenge16: 3,
  challenge17: 3,
  challenge18: 5,
  challenge19: 4,
  challenge20: 4,
  challenge21: 5,
  challenge22: 5,
  challenge23: 1,
  challenge24: 2,
});

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function getTopTeams(req, res) {
  const instances = await getJuiceShopInstances();

  logger.debug(`Listing top teams`);

  const teams = instances.body.items.map((team) => {
    const challengeProgress = JSON.parse(
      team.metadata.annotations['multi-juicer.iteratec.dev/challenges'] ?? '[]'
    ).map((progress) => {
      const difficulty = keyDifficultyMapping[progress.key];

      if (difficulty === undefined) {
        logger.warn(
          `Difficulty for challenge "${progress.key}" is unknown. MultiJuicer version might be incompatible with the Juice Shop version used.`
        );
      }

      return {
        ...progress,
        difficulty,
      };
    });

    let score = 0;
    for (const { difficulty } of challengeProgress) {
      score += difficulty * 10;
    }

    return { name: team.metadata.labels.team, score, challenges: challengeProgress };
  });

  teams.sort((a, b) => b.score - a.score);
  // Get the 25 teams with the highest score
  const topTeams = teams.slice(0, Math.min(teams.length, 24));

  res.status(200).send({ totalTeams: instances.length, teams: topTeams });
}

router.get('/top', getTopTeams);

module.exports = router;
