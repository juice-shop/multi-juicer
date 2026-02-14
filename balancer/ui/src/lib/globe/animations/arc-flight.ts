import type { Line } from "three";

import type { Animation } from "../globe-animator";

const ARC_FLIGHT_DURATION = 800; // ms

/**
 * Progressively reveals an arc line over time using drawRange,
 * creating a "missile launch" flight effect.
 */
export class ArcFlightAnimation implements Animation {
  private line: Line;
  private vertexCount: number;

  constructor(line: Line) {
    this.line = line;
    this.vertexCount = line.geometry.getAttribute("position").count;
    // Start with nothing visible
    line.geometry.setDrawRange(0, 0);
  }

  update(elapsed: number): boolean {
    const progress = Math.min(elapsed / ARC_FLIGHT_DURATION, 1);
    // Ease-out for a decelerating flight feel
    const eased = 1 - (1 - progress) * (1 - progress);
    const count = Math.ceil(eased * this.vertexCount);
    this.line.geometry.setDrawRange(0, count);

    return progress < 1;
  }
}
