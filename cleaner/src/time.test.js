import { test, suite } from 'node:test';
import assert from 'node:assert';

import { parseTimeDurationString, msToHumanReadable } from './time.js';

const Second = 1000;
const Minute = 60 * Second;
const Hour = 60 * Minute;
const Day = Hour * 24;

suite('parseTimeDurationString', () => {
  for (const [durationString, expected] of [
    ['2s', 2 * Second],
    ['2S', 2 * Second],
    ['33m', 33 * Minute],
    ['25M', 25 * Minute],
    ['12h', 12 * Hour],
    ['666H', 666 * Hour],
    ['77d', 77 * Day],
    ['333D', 333 * Day],
    ['2ms', null],
    ['foobar', null],
    ['d7', null],
  ]) {
    test(durationString, () => {
      assert.equal(parseTimeDurationString(durationString), expected);
    });
  }
});

suite('msToHumanReadable', () => {
  for (const [durationInMs, expected] of [
    [999, '<1s'],
    [1000, '1s'],
    [60 * 1000, '1m'],
    [15 * 60 * 1000, '15m'],
    [60 * 60 * 1000, '1h'],
    [15 * 60 * 60 * 1000, '15h'],
    [24 * 60 * 60 * 1000, '1d'],
    [3 * 24 * 60 * 60 * 1000, '3d'],
  ]) {
    test(`${durationInMs}ms`, () => {
      assert.equal(msToHumanReadable(durationInMs), expected);
    });
  }
});
