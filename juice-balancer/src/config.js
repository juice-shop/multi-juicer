import config from '../config/config.json';
import { default as lodashGet } from 'lodash/get';
import memoize from 'lodash/memoize';

const fetchConfigValue = name => {
  const envVarName = name
    .split('.')
    .map(string => string.toUpperCase())
    .join('_');

  return process.env[envVarName] || lodashGet(config, name);
};

export const get = memoize(fetchConfigValue);
