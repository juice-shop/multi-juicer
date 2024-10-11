const durationRegex = /^(\d+)([s,m,h,d])$/;

export function parseTimeDurationString(durationString) {
  const match = durationRegex.exec(durationString.toLowerCase());

  if (match === null) {
    return match;
  }

  // eslint-disable-next-line no-unused-vars
  const [fullMatch, duration, durationUnit] = match;

  switch (durationUnit) {
    case 's':
      return duration * 1000;
    case 'm':
      return duration * 1000 * 60;
    case 'h':
      return duration * 1000 * 60 * 60;
    case 'd':
      return duration * 1000 * 60 * 60 * 24;
    default:
      throw new Error(`Unkown time unit ${durationUnit}`);
  }
}

const Second = 1000;
const Minute = 60 * Second;
const Hour = 60 * Minute;
const Day = Hour * 24;

export function msToHumanReadable(ms) {
  const asDays = Math.floor(ms / Day);
  if (asDays >= 1) {
    return `${asDays}d`;
  }
  const asHours = Math.floor(ms / Hour);
  if (asHours >= 1) {
    return `${asHours}h`;
  }
  const asMinutes = Math.floor(ms / Minute);
  if (asMinutes >= 1) {
    return `${asMinutes}m`;
  }
  const asSeconds = Math.floor(ms / Second);
  if (asSeconds >= 1) {
    return `${asSeconds}s`;
  }
  return '<1s';
}
