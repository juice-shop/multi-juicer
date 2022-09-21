const config = require('../config/config.json');
const lodashGet = require('lodash/get');
const memoize = require('lodash/memoize');

const fetchConfigValue = (name, defaultValue) => {
  const envVarName = name
    .split('.')
    .map((string) => string.toUpperCase())
    .join('_');

  return process.env[envVarName] || lodashGet(config, name, defaultValue);
};

const get = memoize(fetchConfigValue);
module.exports.get = get;

const extractTeamName = (req) => {
  return process.env['NODE_ENV'] === 'test'
    ? req.cookies[get('cookieParser.cookieName')]
    : req.signedCookies[get('cookieParser.cookieName')];
};
module.exports.extractTeamName = extractTeamName;
