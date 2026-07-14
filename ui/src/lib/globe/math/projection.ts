/**
 * Projection - Geographic coordinate transformations
 * Converts latitude/longitude to 3D sphere coordinates
 */

/**
 * Convert latitude/longitude to 3D sphere coordinates
 * @param lon - Longitude in degrees (-180 to 180)
 * @param lat - Latitude in degrees (-90 to 90)
 * @param radius - Sphere radius (default: 1.0)
 * @returns {x, y, z} coordinates on sphere surface
 */
export function latLonToSphere(
  lon: number,
  lat: number,
  radius: number = 1.0
): { x: number; y: number; z: number } {
  // Convert degrees to radians - matching ConicPolygonGeometry's polar2Cartesian
  const phi = (90 - lat) * (Math.PI / 180); // Polar angle (0 at north pole)
  const theta = (90 - lon) * (Math.PI / 180); // Azimuthal angle (matching ConicPolygonGeometry)

  // Spherical to Cartesian conversion (matching ConicPolygonGeometry exactly)
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * Calculate great circle distance between two lat/lon points
 * @param lon1 - First point longitude
 * @param lat1 - First point latitude
 * @param lon2 - Second point longitude
 * @param lat2 - Second point latitude
 * @returns Angular distance in degrees
 */
export function greatCircleDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1Rad) *
      Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return c * (180 / Math.PI); // Return in degrees
}

/**
 * Convert 3D sphere coordinates back to latitude/longitude
 * Inverse of latLonToSphere (matching ConicPolygonGeometry's convention)
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @returns {lon, lat} in degrees, or null if the point is at the origin
 */
export function sphereToLatLon(
  x: number,
  y: number,
  z: number
): { lon: number; lat: number } | null {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 0.001) {
    return null;
  }

  return {
    lat: 90 - Math.acos(y / r) * (180 / Math.PI),
    lon: 90 - Math.atan2(z, x) * (180 / Math.PI),
  };
}
