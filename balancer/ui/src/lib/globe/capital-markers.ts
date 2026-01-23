import { TorusGeometry, MeshBasicMaterial, Mesh, Vector3 } from "three";

import type { CountryData } from "./data/geojson-loader";
import { latLonToSphere } from "./math/projection";

/**
 * Creates yellow donut-shaped (torus) markers for capital cities
 * @param countries - Array of country objects with properties
 * @param highlightedCountryNames - Set of country names that should have capital markers
 * @returns Array of THREE.Mesh objects (torus geometries)
 */
export function createCapitalMarkers(
  countries: CountryData[],
  highlightedCountryNames: Set<string>
): Mesh[] {
  const markers: Mesh[] = [];

  // Group countries by name to handle multipolygons
  const countryMap = new Map<string, CountryData>();
  for (const country of countries) {
    if (!countryMap.has(country.name)) {
      countryMap.set(country.name, country);
    }
  }

  // Create markers for highlighted countries that have capital data
  for (const [countryName, country] of countryMap.entries()) {
    // Only create markers for highlighted countries
    if (!highlightedCountryNames.has(countryName)) {
      continue;
    }

    const props = country.properties;

    // Check if capital coordinates exist
    if (
      !props ||
      typeof props.capitalLat !== "number" ||
      typeof props.capitalLng !== "number"
    ) {
      console.warn(`No capital coordinates for ${countryName}`);
      continue;
    }

    // Convert lat/lon to 3D sphere coordinates at surface level
    const position = latLonToSphere(props.capitalLng, props.capitalLat, 1.0);

    // Create torus geometry (donut shape) with hard edges
    // Parameters: radius, tube diameter, radial segments, tubular segments
    const torusGeometry = new TorusGeometry(
      0.00375, // Main radius of the donut (reduced by 25%)
      0.0015, // Tube thickness (reduced by 25%)
      4, // Radial segments (low number = hard edges)
      8 // Tubular segments (low number = hard edges)
    );

    // Create yellow material
    const torusMaterial = new MeshBasicMaterial({
      color: 0xffff00, // Yellow
      transparent: true,
      opacity: 0.9,
    });

    const torusMesh = new Mesh(torusGeometry, torusMaterial);

    // Calculate the surface normal (outward direction from sphere)
    const normal = new Vector3(position.x, position.y, position.z).normalize();

    // Position the torus at the capital location, offset outward by the torus radius
    // So the inner edge starts at the surface and extends upward
    const offset = normal.clone().multiplyScalar(1.0 + 0.00375);
    torusMesh.position.copy(offset);

    // Orient the torus so the hole faces away from the planet's core
    // Default torus is in XY plane with hole along Z-axis
    // We want the Z-axis (hole direction) to point along the surface normal
    torusMesh.quaternion.setFromUnitVectors(
      new Vector3(0, 0, 1), // Default Z-axis (through the hole)
      normal // Point away from planet core
    );

    torusMesh.name = `capital_${countryName}`;
    markers.push(torusMesh);
  }

  return markers;
}
