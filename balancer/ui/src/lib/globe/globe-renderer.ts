import {
  Line,
  Mesh,
  LineBasicMaterial,
  WireframeGeometry,
  LineSegments,
  Scene,
  Vector3,
  ShaderMaterial,
} from "three";

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
  wireframeLines: Line[] = [];
  stripedMeshes: Mesh[] = [];
  patternMeshes: Mesh[] = [];
  solidMeshes: Mesh[] = [];
  triangleWireframes: LineSegments[] = []; // For visualizing triangle edges
  capitalMarkers: Mesh[] = []; // Yellow donut markers for capitals
  private scene: Scene;
  private textureCache: TextureCache;

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
    for (const { geometry, name } of geometryManager.wireframeGeometries) {
      const line = new Line(geometry, wireframeMaterial);
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
