import { BufferGeometry, Float32BufferAttribute } from "three";

import { interpolateLatLon, latLonToSphere, greatCircleDistance } from "./math/projection";

const ARC_SEGMENTS = 14;
const MIN_ALTITUDE = 0.04;
const ALTITUDE_SCALE = 0.002;

/**
 * Create a parabolic arc geometry along a great circle between two lat/lon points.
 * The arc rises above the globe surface proportionally to the distance between points.
 */
export function createArcGeometry(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): BufferGeometry {
  const dist = greatCircleDistance(fromLon, fromLat, toLon, toLat);
  const peak = MIN_ALTITUDE + dist * ALTITUDE_SCALE;

  const positions = new Float32Array((ARC_SEGMENTS + 1) * 3);

  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS;

    // Great circle interpolation
    const { lat, lon } = interpolateLatLon(fromLon, fromLat, toLon, toLat, t);

    // Parabolic altitude curve: peaks at t=0.5
    const altitude = 4 * peak * t * (1 - t);

    const pos = latLonToSphere(lon, lat, 1.0 + altitude);
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}
