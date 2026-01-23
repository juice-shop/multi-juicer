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

      try {
        // Create filled mesh geometry using ConicPolygonGeometry
        // curvatureResolution: Lower = more detail, higher = fewer vertices
        // Note: Only use ONE closed surface (top), not both, to avoid double-layered geometry
        const conicGeometry = new ConicPolygonGeometry(
          polygon,
          1.0, // bottomHeight (on sphere surface)
          1.0, // topHeight (same as bottom = flat, not extruded)
          false, // closedBottom (disabled to avoid double layer)
          true, // closedTop (single surface facing outward)
          false, // includeSides (no sides for flat polygons)
          3.0 // curvatureResolution in degrees (balance between quality and performance)
        );

        // Extract boundary edges directly from fill geometry
        // This ensures perfect alignment between borders and fills
        const borderGeometry = extractBoundaryEdges(conicGeometry);

        if (conicGeometry && conicGeometry.attributes.position) {
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
 * Extract boundary edges from a BufferGeometry mesh
 * Returns only perimeter edges (edges that belong to exactly one triangle)
 * This ensures perfect alignment with the fill geometry
 */
function extractBoundaryEdges(geometry: BufferGeometry): BufferGeometry {
  const positions = geometry.attributes.position;
  const indices = geometry.index;

  if (!indices) {
    console.warn("Geometry has no index, cannot extract boundary edges");
    return new BufferGeometry();
  }

  // Map: edge key -> count
  const edgeMap = new Map<string, number>();

  // Count each edge occurrence
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i);
    const b = indices.getX(i + 1);
    const c = indices.getX(i + 2);

    incrementEdgeCount(edgeMap, a, b);
    incrementEdgeCount(edgeMap, b, c);
    incrementEdgeCount(edgeMap, c, a);
  }

  // Extract boundary edges (count === 1)
  const vertices: number[] = [];

  for (const [edgeKey, count] of edgeMap.entries()) {
    if (count === 1) {
      const [a, b] = edgeKey.split(",").map(Number);

      // Add both vertices of the edge
      vertices.push(
        positions.getX(a),
        positions.getY(a),
        positions.getZ(a),
        positions.getX(b),
        positions.getY(b),
        positions.getZ(b)
      );
    }
  }

  const boundaryGeometry = new BufferGeometry();
  boundaryGeometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(vertices), 3)
  );

  return boundaryGeometry;
}

/**
 * Helper: Increment edge count in map with normalized key
 */
function incrementEdgeCount(
  map: Map<string, number>,
  a: number,
  b: number
): void {
  // Normalize edge key (smaller index first)
  const key = a < b ? `${a},${b}` : `${b},${a}`;
  map.set(key, (map.get(key) || 0) + 1);
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
