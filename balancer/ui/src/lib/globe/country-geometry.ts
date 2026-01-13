import { BufferGeometry } from "three";

import type { CountryData } from "./data/geojson-loader";

interface GeometryWithName {
  name: string;
  geometry: BufferGeometry;
}

/**
 * Manages creation of Three.js geometries for country data
 * Uses three-conic-polygon-geometry for proper spherical rendering
 */
export class CountryGeometryManager {
  wireframeGeometries: GeometryWithName[] = [];
  stripedGeometries: GeometryWithName[] = [];
  patternGeometries: GeometryWithName[] = [];
  solidGeometries: GeometryWithName[] = [];
  highlightedCountries: Set<string> = new Set();
  totalVertexCount: number = 0;
  countriesWithChallenges: Set<string>;
  solvedCountries: Set<string>;
  countryPatternMap: Map<string, number>;

  constructor(
    countries: CountryData[],
    solvedCountries: Set<string>,
    countriesWithChallenges: Set<string>,
    solvedWithPatterns: Map<string, number>
  ) {
    this.countriesWithChallenges = countriesWithChallenges;
    this.solvedCountries = solvedCountries;
    this.countryPatternMap = solvedWithPatterns;
    this.createGeometries(countries);
  }

  createGeometries(countries: CountryData[]): void {
    for (const country of countries) {
      // Use the filled mesh geometry from three-conic-polygon-geometry
      const geometry = country.geometry;
      geometry.name = country.name;

      // Use the border line geometry for wireframes
      const borderGeometry = country.borderGeometry;
      borderGeometry.name = country.name;

      // All countries get wireframe borders
      this.wireframeGeometries.push({
        name: country.name,
        geometry: borderGeometry,
      });

      // Count wireframe vertices
      const borderPositionAttr = borderGeometry.attributes.position;
      if (borderPositionAttr) {
        this.totalVertexCount += borderPositionAttr.count;
      }

      // Determine fill type
      const fillType = this.getFillType(country.name);

      // Create filled geometry for pattern or solid countries
      if (fillType !== "none") {
        this.highlightedCountries.add(country.name);

        const positionAttr = geometry.attributes.position;

        if (fillType === "pattern") {
          // Pattern countries use the new pattern-based rendering
          this.patternGeometries.push({
            name: country.name,
            geometry: geometry,
          });
          // Count vertices
          if (positionAttr) {
            this.totalVertexCount += positionAttr.count;
          }
        } else if (fillType === "solid") {
          this.solidGeometries.push({
            name: country.name,
            geometry: geometry,
          });
          // Count vertices for solid
          if (positionAttr) {
            this.totalVertexCount += positionAttr.count;
          }
        }

        const indexAttr = geometry.index;
        const triangleCount = indexAttr
          ? indexAttr.count / 3
          : positionAttr.count / 3;
        console.log(
          `Created ${fillType} geometry for ${country.name}: ${triangleCount} triangles`
        );
      }
    }

    console.log(
      `Created ${this.wireframeGeometries.length} wireframe geometries`
    );
    console.log(`Created ${this.patternGeometries.length} pattern geometries`);
    console.log(`Created ${this.solidGeometries.length} solid geometries`);
    console.log(
      `Total vertex count: ${this.totalVertexCount.toLocaleString()}`
    );
  }

  /**
   * Determine the fill type for a country
   */
  getFillType(name: string): "pattern" | "solid" | "none" {
    if (this.solvedCountries.has(name) && this.countryPatternMap.has(name)) {
      return "pattern";
    }

    if (this.countriesWithChallenges.has(name)) {
      return "solid";
    }

    return "none";
  }

  /**
   * Get the pattern index for a country
   */
  getPatternIndex(countryName: string): number | undefined {
    return this.countryPatternMap.get(countryName);
  }
}
