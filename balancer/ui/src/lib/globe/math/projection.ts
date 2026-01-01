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
 * Interpolate between two lat/lon points along great circle
 * @param lon1 - Start longitude
 * @param lat1 - Start latitude
 * @param lon2 - End longitude
 * @param lat2 - End latitude
 * @param t - Interpolation factor (0 to 1)
 * @returns {lon, lat} interpolated coordinates
 */
export function interpolateLatLon(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  t: number
): { lon: number; lat: number } {
  const lat1Rad = lat1 * (Math.PI / 180);
  const lon1Rad = lon1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  const lon2Rad = lon2 * (Math.PI / 180);

  const d = Math.acos(
    Math.sin(lat1Rad) * Math.sin(lat2Rad) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad)
  );

  if (d < 1e-10) {
    // Points are very close, use linear interpolation
    return {
      lon: lon1 + (lon2 - lon1) * t,
      lat: lat1 + (lat2 - lat1) * t,
    };
  }

  const a = Math.sin((1 - t) * d) / Math.sin(d);
  const b = Math.sin(t * d) / Math.sin(d);

  const x =
    a * Math.cos(lat1Rad) * Math.cos(lon1Rad) +
    b * Math.cos(lat2Rad) * Math.cos(lon2Rad);
  const y =
    a * Math.cos(lat1Rad) * Math.sin(lon1Rad) +
    b * Math.cos(lat2Rad) * Math.sin(lon2Rad);
  const z = a * Math.sin(lat1Rad) + b * Math.sin(lat2Rad);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);

  return {
    lon: lon * (180 / Math.PI),
    lat: lat * (180 / Math.PI),
  };
}
