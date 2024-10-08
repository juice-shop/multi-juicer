import { get as lodashGet, memoize } from 'lodash-es';
import { readFileSync } from 'node:fs';

const configFile = JSON.parse(readFileSync('./config/config.json'));

function fetchConfigValue(name, defaultValue) {
  const envVarName = name
    .split('.')
    .map((string) => string.toUpperCase())
    .join('_');

  return process.env[envVarName] || lodashGet(configFile, name, defaultValue);
}

export const get = memoize(fetchConfigValue);
