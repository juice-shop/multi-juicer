import config from '../config/config.json';
import { default as lodashGet } from 'lodash/get';
import memoize from 'lodash/memoize';

const fetchConfigValue = name => {
  const envVarName = name
    .split('.')
    .map(string => string.toUpperCase())
    .join('_');

  console.log(`Config "${name}": "${process.env[envVarName] || lodashGet(config, name)}"`);
  return process.env[envVarName] || lodashGet(config, name);
};

export const get = memoize(fetchConfigValue);
