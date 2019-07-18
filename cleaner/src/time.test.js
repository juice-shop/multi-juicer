const { parseTimeDurationString, msToHumanReadable } = require('./time');

const Second = 1000;
const Minute = 60 * Second;
const Hour = 60 * Minute;
const Day = Hour * 24;

describe('parseTimeDurationString', () => {
  describe.each([
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
  ])('%s', (durationString, expected) => {
    test(`should be ${expected}ms`, () => {
      expect(parseTimeDurationString(durationString)).toBe(expected);
    });
  });
});

describe('msToHumanReadable', () => {
  describe.each([
    [999, '<1s'],
    [1000, '1s'],
    [60 * 1000, '1m'],
    [15 * 60 * 1000, '15m'],
    [60 * 60 * 1000, '1h'],
    [15 * 60 * 60 * 1000, '15h'],
    [24 * 60 * 60 * 1000, '1d'],
    [3 * 24 * 60 * 60 * 1000, '3d'],
  ])('%dms', (durationString, expected) => {
    test(`should be ${expected}`, () => {
      expect(msToHumanReadable(durationString)).toBe(expected);
    });
  });
});
