/**
 * GeoJSON Loader - Parse and convert geographic data to 3D vertices
 * Uses three-conic-polygon-geometry for proper spherical polygon rendering
 */

import { BufferGeometry, BufferAttribute } from "three";
import ConicPolygonGeometry from "three-conic-polygon-geometry";

// GeoJSON type definitions
interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: GeoJSONGeometry;
}

interface GeoJSONGeometry {
  type: "Polygon" | "MultiPolygon" | string;
  coordinates: number[][][] | number[][][][];
}

// Debug: Check if import worked
console.log(
  "ConicPolygonGeometry imported:",
  typeof ConicPolygonGeometry,
  ConicPolygonGeometry
);

export interface CountryData {
  name: string;
  partIndex: number;
  geometry: BufferGeometry; // Filled mesh geometry
  borderGeometry: BufferGeometry; // Border line geometry
  properties: Record<string, unknown>;
}

/**
 * Load and parse GeoJSON file using three-conic-polygon-geometry
 * This library properly handles spherical polygons with correct curvature
 * @param onProgress - Progress callback (optional)
 * @returns Array of country objects with geometry data
 */
export async function loadGeoJSON(
  onProgress: ((progress: number) => void) | null = null
): Promise<CountryData[]> {
  try {
    const response = await fetch("/balancer/world.geo.json");
    if (!response.ok) {
      throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
    }

    if (onProgress) onProgress(0.3);

    const geojson = await response.json();

    if (onProgress) onProgress(0.5);

    const countries = processGeoJSON(geojson, onProgress);

    if (onProgress) onProgress(1.0);

    console.log(`Loaded ${countries.length} country geometries`);

    return countries;
  } catch (error) {
    console.error("Error loading GeoJSON:", error);
    throw error;
  }
}

/**
 * Process GeoJSON FeatureCollection using three-conic-polygon-geometry
 */
function processGeoJSON(
  geojson: GeoJSONFeatureCollection,
  onProgress: ((progress: number) => void) | null
): CountryData[] {
  if (geojson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: expected FeatureCollection");
  }

  const countries: CountryData[] = [];
  let processedCount = 0;
  const totalFeatures = geojson.features.length;

  for (const feature of geojson.features) {
    const props = feature.properties;
    const countryName =
      (typeof props?.name === "string" ? props.name : null) ||
      (typeof props?.admin === "string" ? props.admin : null) ||
      (typeof props?.NAME === "string" ? props.NAME : null) ||
      "Unknown";
    const geometry = feature.geometry;

    if (!geometry) continue;

    // Extract polygon coordinates
    const polygons = extractPolygons(geometry);

    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i];

      // Validate polygon structure
      if (!polygon || !Array.isArray(polygon) || polygon.length === 0) {
        console.warn(`Invalid polygon for ${countryName} part ${i}:`, polygon);
        continue;
      }

      console.log(`${countryName} part ${i} polygon structure:`, {
        isArray: Array.isArray(polygon),
        length: polygon.length,
        firstRingLength: polygon[0]?.length,
        firstPoint: polygon[0]?.[0],
      });

      try {
        console.log(
          `Creating geometry for ${countryName} part ${i} with polygon:`,
          polygon
        );

        // Create filled mesh geometry using ConicPolygonGeometry
        // curvatureResolution: Lower = more detail, higher = fewer vertices
        const conicGeometry = new ConicPolygonGeometry(
          polygon,
          1.0, // bottomHeight (on sphere surface)
          1.0, // topHeight (flat, not extruded)
          true, // closedBottom
          true, // closedTop
          false, // includeSides (no sides for flat polygons)
          3.0 // curvatureResolution in degrees (balance between quality and performance)
        );

        // Create border line geometry from polygon outline
        const borderGeometry = createBorderGeometry(polygon);

        console.log(
          `Created geometry for ${countryName} part ${i}:`,
          conicGeometry
        );

        if (conicGeometry && conicGeometry.attributes.position) {
          const vertexCount = conicGeometry.attributes.position.count;
          console.log(`${countryName} part ${i}: ${vertexCount} vertices`);

          countries.push({
            name: countryName,
            partIndex: i,
            geometry: conicGeometry,
            borderGeometry: borderGeometry,
            properties: feature.properties || {},
          });
        } else {
          console.warn(
            `Geometry for ${countryName} part ${i} has no position attribute`
          );
        }
      } catch (error) {
        console.error(
          `Failed to create geometry for ${countryName} part ${i}:`,
          error,
          "\nPolygon was:",
          polygon
        );
      }
    }

    processedCount++;
    if (onProgress && processedCount % 10 === 0) {
      onProgress(0.5 + (processedCount / totalFeatures) * 0.5);
    }
  }

  return countries;
}

type PolygonCoordinates = number[][][]; // [rings][points][lon, lat]

/**
 * Extract polygon coordinates from geometry (handles Polygon and MultiPolygon)
 */
function extractPolygons(geometry: GeoJSONGeometry): PolygonCoordinates[] {
  const polygons: PolygonCoordinates[] = [];

  if (geometry.type === "Polygon") {
    polygons.push(geometry.coordinates as PolygonCoordinates);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      polygons.push(polygon as PolygonCoordinates);
    }
  }

  return polygons;
}

/**
 * Create border line geometry from polygon coordinates
 * Projects lat/lon to sphere surface and creates line segments
 */
function createBorderGeometry(polygon: PolygonCoordinates): BufferGeometry {
  const vertices: number[] = [];

  // Process outer ring (polygon[0]) and holes (polygon[1+])
  for (let ringIdx = 0; ringIdx < polygon.length; ringIdx++) {
    const ring = polygon[ringIdx];

    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];

      // Convert lat/lon to radians (match ConicPolygonGeometry's polar2Cartesian exactly)
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (90 - lon) * (Math.PI / 180);

      // Project to unit sphere (r = 1.0, matching ConicPolygonGeometry)
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      vertices.push(x, y, z);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(vertices), 3)
  );

  return geometry;
}

/**
 * Get countries by continent or region
 */
export function filterCountriesByContinent(
  countries: CountryData[],
  continent: string
): CountryData[] {
  return countries.filter(
    (country) => country.properties.continent === continent
  );
}

/**
 * Find country by name
 */
export function findCountryByName(
  countries: CountryData[],
  name: string
): CountryData[] {
  return countries.filter((country) =>
    country.name.toLowerCase().includes(name.toLowerCase())
  );
}
