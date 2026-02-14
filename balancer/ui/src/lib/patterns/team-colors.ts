/**
 * Golden-ratio hue spread for maximally separated team colors.
 * Input: the pattern index from getPatternIndexForTeam().
 */

const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;
const SATURATION = 0.8;
const LIGHTNESS = 0.6;

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  const sector = Math.floor(h * 6);
  switch (sector % 6) {
    case 0:
      r = c;
      g = x;
      break;
    case 1:
      r = x;
      g = c;
      break;
    case 2:
      g = c;
      b = x;
      break;
    case 3:
      g = x;
      b = c;
      break;
    case 4:
      r = x;
      b = c;
      break;
    case 5:
      r = c;
      b = x;
      break;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function getTeamColor(patternIndex: number): {
  r: number;
  g: number;
  b: number;
  hex: number;
} {
  const hue = (patternIndex * GOLDEN_RATIO_CONJUGATE) % 1;
  const { r, g, b } = hslToRgb(hue, SATURATION, LIGHTNESS);
  const hex = (r << 16) | (g << 8) | b;
  return { r, g, b, hex };
}
