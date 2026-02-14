import {
  Mesh,
  Line,
  Group,
  LineBasicMaterial,
  WireframeGeometry,
  LineSegments,
  Scene,
  Vector3,
  ShaderMaterial,
} from "three";

import { createArcGeometry } from "./arc-geometry";

import { getPatternPathByIndex } from "../patterns/pattern-selector";
import { TextureCache } from "../patterns/texture-cache";

import { createCapitalMarkers } from "./capital-markers";
import type { CountryGeometryManager } from "./country-geometry";
import type { CountryData } from "./data/geojson-loader";
import { createNeonPatternMaterial } from "./materials/neon-pattern";
import { createNeonSolidMaterial } from "./materials/neon-solid";
import { createNeonStripedMaterial } from "./materials/neon-striped";
import { createNeonWireframeMaterial } from "./materials/neon-wireframe";

// DEBUG: Toggle triangle wireframe visualization
const SHOW_TRIANGLE_WIREFRAMES = false;

interface ThemeColors {
  primary: number[];
  accent: number[];
  secondary: number[];
  glowIntensity: number;
}

/**
 * Manages globe rendering objects (wireframe lines, striped meshes, solid meshes, and capital markers)
 * Adds all country geometries to the scene with appropriate materials
 */
export class GlobeRenderer {
  wireframeLines: LineSegments[] = []; // Country border lines as individual segments
  stripedMeshes: Mesh[] = [];
  patternMeshes: Mesh[] = [];
  solidMeshes: Mesh[] = [];
  triangleWireframes: LineSegments[] = []; // For visualizing triangle edges
  capitalMarkers: Mesh[] = []; // Yellow donut markers for capitals
  private scene: Scene;
  private textureCache: TextureCache;
  /** Map of country name → capital {lat, lon} for camera focus animations */
  private countryCenters = new Map<string, { lat: number; lon: number }>();

  /** Arc state — managed imperatively, no React involvement */
  private arcGroups = new Map<string, Group>();
  private teamLastSolveCoords = new Map<
    string,
    { lat: number; lon: number }
  >();
  private arcKeys = new Set<string>();

  constructor(scene: Scene) {
    this.scene = scene;
    this.textureCache = TextureCache.getInstance();
  }

  async initialize(
    geometryManager: CountryGeometryManager,
    themeColors: ThemeColors,
    countries: CountryData[]
  ): Promise<void> {
    await this.createRenderObjects(geometryManager, themeColors, countries);
  }

  private async createRenderObjects(
    geometryManager: CountryGeometryManager,
    themeColors: ThemeColors,
    countries: CountryData[]
  ): Promise<void> {
    // Create wireframe material (shared across all country borders)
    const wireframeMaterial = createNeonWireframeMaterial(
      themeColors.primary,
      themeColors.glowIntensity
    );

    // Create wireframe lines for all countries
    // Use LineSegments because boundary edge geometry is individual segments (not a continuous path)
    for (const { geometry, name } of geometryManager.wireframeGeometries) {
      const line = new LineSegments(geometry, wireframeMaterial);
      line.name = name;
      this.wireframeLines.push(line);
      this.scene.add(line);
    }

    // Create striped meshes for specific countries
    for (const { geometry, name } of geometryManager.stripedGeometries) {
      // Create per-country material for individual hover control
      const stripedMaterial = createNeonStripedMaterial(
        themeColors.primary,
        themeColors.glowIntensity
      );

      const mesh = new Mesh(geometry, stripedMaterial);
      mesh.name = name;
      mesh.userData.countryName = name; // For raycasting identification
      this.stripedMeshes.push(mesh);
      this.scene.add(mesh);

      // DEBUG: Add wireframe overlay to visualize triangle edges
      if (SHOW_TRIANGLE_WIREFRAMES) {
        const wireframeMat = new LineBasicMaterial({
          color: 0xff00ff, // Magenta for triangle edges
          linewidth: 1,
          opacity: 0.8,
          transparent: true,
        });
        // With uniform subdivision, WireframeGeometry works perfectly
        // because all neighboring triangles subdivide shared edges identically
        const wireframeGeo = new WireframeGeometry(geometry);
        const wireframeMesh = new LineSegments(wireframeGeo, wireframeMat);
        wireframeMesh.name = `${name}_wireframe`;
        this.triangleWireframes.push(wireframeMesh);
        this.scene.add(wireframeMesh);
      }
    }

    // Create pattern meshes for solved challenges
    for (const { geometry, name } of geometryManager.patternGeometries) {
      const patternIndex = geometryManager.getPatternIndex(name);

      if (patternIndex === undefined) {
        console.warn(`No pattern index for country: ${name}`);
        continue;
      }

      // Load texture
      const patternPath = getPatternPathByIndex(patternIndex);

      try {
        const texture = await this.textureCache.loadTexture(patternPath);

        // Create pattern material
        const patternMaterial = createNeonPatternMaterial(
          themeColors.primary,
          themeColors.glowIntensity,
          texture
        );

        const mesh = new Mesh(geometry, patternMaterial);
        mesh.name = name;
        mesh.userData.countryName = name;
        this.patternMeshes.push(mesh);
        this.scene.add(mesh);
      } catch (error) {
        console.error(`Failed to load pattern for ${name}:`, error);
        // Fallback: use solid material
        const solidMaterial = createNeonSolidMaterial(
          themeColors.primary,
          themeColors.glowIntensity
        );
        const mesh = new Mesh(geometry, solidMaterial);
        mesh.name = name;
        mesh.userData.countryName = name;
        this.solidMeshes.push(mesh);
        this.scene.add(mesh);
      }
    }

    // Create solid meshes for top 100 populated countries
    for (const { geometry, name } of geometryManager.solidGeometries) {
      // Create per-country material for individual hover control
      const solidMaterial = createNeonSolidMaterial(
        themeColors.primary,
        themeColors.glowIntensity
      );

      const mesh = new Mesh(geometry, solidMaterial);
      mesh.name = name;
      mesh.userData.countryName = name; // For raycasting identification
      this.solidMeshes.push(mesh);
      this.scene.add(mesh);

      // DEBUG: Add wireframe overlay to visualize triangle edges
      if (SHOW_TRIANGLE_WIREFRAMES) {
        const wireframeMat = new LineBasicMaterial({
          color: 0xff00ff, // Magenta for triangle edges
          linewidth: 1,
          opacity: 0.8,
          transparent: true,
        });
        // With uniform subdivision, WireframeGeometry works perfectly
        // because all neighboring triangles subdivide shared edges identically
        const wireframeGeo = new WireframeGeometry(geometry);
        const wireframeMesh = new LineSegments(wireframeGeo, wireframeMat);
        wireframeMesh.name = `${name}_wireframe`;
        this.triangleWireframes.push(wireframeMesh);
        this.scene.add(wireframeMesh);
      }
    }

    // Create capital markers for highlighted countries
    this.capitalMarkers = createCapitalMarkers(
      countries,
      geometryManager.highlightedCountries
    );
    for (const marker of this.capitalMarkers) {
      this.scene.add(marker);
    }

    // Build country center lookup from capital coordinates
    for (const country of countries) {
      if (this.countryCenters.has(country.name)) continue;
      const props = country.properties;
      if (
        props &&
        typeof props.capitalLat === "number" &&
        typeof props.capitalLng === "number"
      ) {
        this.countryCenters.set(country.name, {
          lat: props.capitalLat,
          lon: props.capitalLng,
        });
      }
    }

    // Fallback: for countries without capital data, compute center from solid mesh bounding sphere
    for (const mesh of this.solidMeshes) {
      if (this.countryCenters.has(mesh.name)) continue;
      mesh.geometry.computeBoundingSphere();
      const center = mesh.geometry.boundingSphere?.center;
      if (center) {
        // Convert 3D position back to lat/lon (reverse of latLonToSphere)
        const r = center.length();
        if (r > 0.001) {
          const lat = 90 - Math.acos(center.y / r) * (180 / Math.PI);
          const lon = 90 - Math.atan2(center.z, center.x) * (180 / Math.PI);
          this.countryCenters.set(mesh.name, { lat, lon });
        }
      }
    }
  }

  /**
   * Look up the center coordinates for a country (capital city or geometry centroid).
   */
  getCountryCenter(countryName: string): { lat: number; lon: number } | null {
    return this.countryCenters.get(countryName) ?? null;
  }

  /**
   * Transition a country from solid fill to pattern fill (when challenge is solved)
   * This is an imperative update that doesn't require React re-render
   * Handles multi-polygon countries (e.g., Japan with multiple islands) by transitioning all parts
   */
  async transitionCountryToSolved(
    countryName: string,
    patternIndex: number,
    themeColors: { primary: number[]; glowIntensity: number }
  ): Promise<void> {
    // Find ALL solid meshes for this country (handles multi-polygon countries like Japan)
    const solidMeshesToTransition = this.solidMeshes.filter(
      (mesh) => mesh.name === countryName
    );

    if (solidMeshesToTransition.length === 0) {
      console.warn(
        `Cannot transition country "${countryName}": no solid mesh found`
      );
      return;
    }

    // Load the pattern texture once
    const patternPath = getPatternPathByIndex(patternIndex);

    try {
      const texture = await this.textureCache.loadTexture(patternPath);

      // Create pattern material (shared across all parts of the country)
      const patternMaterial = createNeonPatternMaterial(
        themeColors.primary,
        themeColors.glowIntensity,
        texture
      );

      // Transition each part (island) of the country
      for (const solidMesh of solidMeshesToTransition) {
        // Create new pattern mesh using the SAME geometry
        const patternMesh = new Mesh(solidMesh.geometry, patternMaterial);
        patternMesh.name = countryName;
        patternMesh.userData.countryName = countryName;

        // Hide the solid mesh
        solidMesh.visible = false;

        // Add pattern mesh to scene and track it
        this.patternMeshes.push(patternMesh);
        this.scene.add(patternMesh);
      }
    } catch (error) {
      console.error(
        `Failed to transition country "${countryName}" to pattern:`,
        error
      );
    }
  }

  /**
   * Read-only accessor for country center coordinates.
   */
  getCountryCenters(): Map<string, { lat: number; lon: number }> {
    return this.countryCenters;
  }

  /**
   * Build all arcs for a team from an ordered list of solve coordinates.
   * Returns the created Line objects (for optional animation).
   */
  addTeamArcs(
    teamName: string,
    solveCoords: Array<{ lat: number; lon: number }>,
    colorHex: number
  ): Line[] {
    if (solveCoords.length < 2) {
      // Need at least 2 points to draw an arc; record last coord for future appends
      if (solveCoords.length === 1) {
        this.teamLastSolveCoords.set(teamName, solveCoords[0]);
      }
      return [];
    }

    let group = this.arcGroups.get(teamName);
    if (!group) {
      group = new Group();
      group.name = `arcs_${teamName}`;
      this.arcGroups.set(teamName, group);
      this.scene.add(group);
    }

    const material = new LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.6,
    });

    const lines: Line[] = [];

    for (let i = 1; i < solveCoords.length; i++) {
      const from = solveCoords[i - 1];
      const to = solveCoords[i];
      const key = `${teamName}:${from.lat},${from.lon}:${to.lat},${to.lon}`;

      if (this.arcKeys.has(key)) continue;
      this.arcKeys.add(key);

      const geometry = createArcGeometry(from.lat, from.lon, to.lat, to.lon);
      const line = new Line(geometry, material);
      group.add(line);
      lines.push(line);
    }

    this.teamLastSolveCoords.set(
      teamName,
      solveCoords[solveCoords.length - 1]
    );
    return lines;
  }

  /**
   * Append a single arc from the team's last known solve position to a new coordinate.
   * Returns the Line for animation, or null if this is the team's first solve or a duplicate.
   */
  appendTeamArc(
    teamName: string,
    newCoord: { lat: number; lon: number },
    colorHex: number
  ): Line | null {
    const lastCoord = this.teamLastSolveCoords.get(teamName);
    this.teamLastSolveCoords.set(teamName, newCoord);

    if (!lastCoord) return null;

    const key = `${teamName}:${lastCoord.lat},${lastCoord.lon}:${newCoord.lat},${newCoord.lon}`;
    if (this.arcKeys.has(key)) return null;
    this.arcKeys.add(key);

    let group = this.arcGroups.get(teamName);
    if (!group) {
      group = new Group();
      group.name = `arcs_${teamName}`;
      this.arcGroups.set(teamName, group);
      this.scene.add(group);
    }

    const geometry = createArcGeometry(
      lastCoord.lat,
      lastCoord.lon,
      newCoord.lat,
      newCoord.lon
    );
    const material = new LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.6,
    });
    const line = new Line(geometry, material);
    group.add(line);
    return line;
  }

  /**
   * Remove all arcs for a team and dispose resources.
   */
  removeTeamArcs(teamName: string): void {
    const group = this.arcGroups.get(teamName);
    if (!group) return;

    group.traverse((child) => {
      if (child instanceof Line) {
        child.geometry.dispose();
        if (child.material instanceof LineBasicMaterial) {
          child.material.dispose();
        }
      }
    });

    this.scene.remove(group);
    this.arcGroups.delete(teamName);
    this.teamLastSolveCoords.delete(teamName);

    // Clean up arc keys for this team
    for (const key of this.arcKeys) {
      if (key.startsWith(`${teamName}:`)) {
        this.arcKeys.delete(key);
      }
    }
  }

  /**
   * Update camera position uniform for all materials
   * Called every frame to ensure correct depth-based effects
   */
  updateUniforms(cameraPosition: Vector3): void {
    // Update wireframe materials
    for (const line of this.wireframeLines) {
      const material = line.material as ShaderMaterial;
      if (material.uniforms?.u_cameraPosition) {
        material.uniforms.u_cameraPosition.value.copy(cameraPosition);
      }
    }

    // Update striped materials
    for (const mesh of this.stripedMeshes) {
      const material = mesh.material as ShaderMaterial;
      if (material.uniforms?.u_cameraPosition) {
        material.uniforms.u_cameraPosition.value.copy(cameraPosition);
      }
    }

    // Update pattern materials
    for (const mesh of this.patternMeshes) {
      const material = mesh.material as ShaderMaterial;
      if (material.uniforms?.u_cameraPosition) {
        material.uniforms.u_cameraPosition.value.copy(cameraPosition);
      }
    }

    // Update solid materials
    for (const mesh of this.solidMeshes) {
      const material = mesh.material as ShaderMaterial;
      if (material.uniforms?.u_cameraPosition) {
        material.uniforms.u_cameraPosition.value.copy(cameraPosition);
      }
    }
  }
}
