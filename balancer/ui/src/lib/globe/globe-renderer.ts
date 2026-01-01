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

import { createCapitalMarkers } from "./capital-markers";
import type { CountryGeometryManager } from "./country-geometry";
import type { CountryData } from "./data/geojson-loader";
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
  solidMeshes: Mesh[] = [];
  triangleWireframes: LineSegments[] = []; // For visualizing triangle edges
  capitalMarkers: Mesh[] = []; // Yellow donut markers for capitals
  private scene: Scene;

  constructor(
    scene: Scene,
    geometryManager: CountryGeometryManager,
    themeColors: ThemeColors,
    countries: CountryData[]
  ) {
    this.scene = scene;
    this.createRenderObjects(geometryManager, themeColors, countries);
  }

  private createRenderObjects(
    geometryManager: CountryGeometryManager,
    themeColors: ThemeColors,
    countries: CountryData[]
  ): void {
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

    console.log(`Added ${this.wireframeLines.length} wireframe lines to scene`);

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

    console.log(`Added ${this.stripedMeshes.length} striped meshes to scene`);

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

    console.log(`Added ${this.solidMeshes.length} solid meshes to scene`);

    if (SHOW_TRIANGLE_WIREFRAMES) {
      console.log(
        `Added ${this.triangleWireframes.length} triangle wireframe overlays`
      );
    }

    // Create capital markers for highlighted countries
    this.capitalMarkers = createCapitalMarkers(
      countries,
      geometryManager.highlightedCountries
    );
    for (const marker of this.capitalMarkers) {
      this.scene.add(marker);
    }

    console.log(`Added ${this.capitalMarkers.length} capital markers to scene`);
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

    // Update solid materials
    for (const mesh of this.solidMeshes) {
      const material = mesh.material as ShaderMaterial;
      if (material.uniforms?.u_cameraPosition) {
        material.uniforms.u_cameraPosition.value.copy(cameraPosition);
      }
    }
  }
}
