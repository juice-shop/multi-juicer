const express = require('express');

const router = express.Router();

const { getJuiceShopInstances } = require('../kubernetes');
const { logger } = require('../logger');

// Generated via: `curl https://demo.owasp-juice.shop/api/challenges | jq '.data | map({ key: .key, value: .difficulty }) | from_entries'`
const keyDifficultyMapping = Object.freeze({
  restfulXssChallenge: 3,
  accessLogDisclosureChallenge: 4,
  registerAdminChallenge: 3,
  adminSectionChallenge: 2,
  fileWriteChallenge: 6,
  resetPasswordBjoernOwaspChallenge: 3,
  tokenSaleChallenge: 5,
  rceChallenge: 5,
  captchaBypassChallenge: 3,
  changePasswordBenderChallenge: 5,
  christmasSpecialChallenge: 4,
  usernameXssChallenge: 4,
  persistedXssUserChallenge: 3,
  directoryListingChallenge: 1,
  localXssChallenge: 1,
  dbSchemaChallenge: 3,
  deprecatedInterfaceChallenge: 2,
  easterEggLevelOneChallenge: 4,
  emailLeakChallenge: 5,
  ephemeralAccountantChallenge: 4,
  errorHandlingChallenge: 1,
  manipulateClockChallenge: 4,
  extraLanguageChallenge: 5,
  feedbackChallenge: 2,
  forgedCouponChallenge: 6,
  forgedFeedbackChallenge: 3,
  forgedReviewChallenge: 3,
  jwtForgedChallenge: 6,
  forgottenDevBackupChallenge: 4,
  forgottenBackupChallenge: 4,
  typosquattingAngularChallenge: 5,
  ghostLoginChallenge: 3,
  dataExportChallenge: 4,
  httpHeaderXssChallenge: 4,
  continueCodeChallenge: 6,
  dlpPasswordSprayingChallenge: 5,
  dlpPastebinDataLeakChallenge: 4,
  typosquattingNpmChallenge: 4,
  loginAdminChallenge: 2,
  loginAmyChallenge: 3,
  loginBenderChallenge: 3,
  oauthUserPasswordChallenge: 4,
  loginCisoChallenge: 5,
  loginJimChallenge: 3,
  loginRapperChallenge: 2,
  loginSupportChallenge: 6,
  basketManipulateChallenge: 3,
  misplacedSignatureFileChallenge: 4,
  timingAttackChallenge: 6,
  easterEggLevelTwoChallenge: 4,
  noSqlCommandChallenge: 4,
  noSqlOrdersChallenge: 5,
  noSqlReviewsChallenge: 4,
  redirectCryptoCurrencyChallenge: 1,
  weakPasswordChallenge: 2,
  negativeOrderChallenge: 3,
  premiumPaywallChallenge: 6,
  privacyPolicyChallenge: 1,
  privacyPolicyProofChallenge: 3,
  changeProductChallenge: 3,
  reflectedXssChallenge: 2,
  passwordRepeatChallenge: 1,
  resetPasswordBenderChallenge: 4,
  resetPasswordBjoernChallenge: 5,
  resetPasswordJimChallenge: 3,
  resetPasswordMortyChallenge: 5,
  retrieveBlueprintChallenge: 5,
  ssrfChallenge: 6,
  sstiChallenge: 6,
  scoreBoardChallenge: 1,
  securityPolicyChallenge: 2,
  persistedXssFeedbackChallenge: 4,
  hiddenImageChallenge: 4,
  rceOccupyChallenge: 6,
  supplyChainAttackChallenge: 5,
  twoFactorAuthUnsafeSecretStorageChallenge: 5,
  jwtUnsignedChallenge: 5,
  uploadSizeChallenge: 3,
  uploadTypeChallenge: 3,
  unionSqlInjectionChallenge: 4,
  videoXssChallenge: 6,
  basketAccessChallenge: 2,
  knownVulnerableComponentChallenge: 4,
  weirdCryptoChallenge: 2,
  redirectChallenge: 4,
  xxeFileDisclosureChallenge: 3,
  xxeDosChallenge: 5,
  zeroStarsChallenge: 1,
  missingEncodingChallenge: 1,
  svgInjectionChallenge: 5,
  exposedMetricsChallenge: 1,
  freeDeluxeChallenge: 3,
  csrfChallenge: 3,
  xssBonusChallenge: 1,
  resetPasswordUvoginChallenge: 4,
  geoStalkingMetaChallenge: 2,
  geoStalkingVisualChallenge: 2,
  killChatbotChallenge: 5,
  nullByteChallenge: 4,
  bullyChatbotChallenge: 1,
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
