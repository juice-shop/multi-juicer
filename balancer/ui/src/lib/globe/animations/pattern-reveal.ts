/**
 * Expanding ring reveal animation for solved country pattern fill.
 * Animates u_revealRadius from 0 → maxRadius, creating a radial wipe
 * that originates from the country's capital.
 */

import { Vector3, type BufferGeometry } from "three";
import type { Mesh, ShaderMaterial } from "three";

import type { Animation } from "../globe-animator";

/** Ease-out cubic */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const DEFAULT_DURATION = 2700; // ms
const FULLY_REVEALED = 999.0;
const MIN_RADIUS = 0.06; // radians — floor so tiny countries still have a visible sweep
const RADIUS_PADDING = 0.04; // extra radians beyond the farthest vertex

/**
 * Compute the maximum angular distance (in radians) from a center point
 * to any vertex in a set of mesh geometries.
 */
function computeAngularExtent(meshes: Mesh[], center: Vector3): number {
  const normalizedCenter = center.clone().normalize();
  const vertex = new Vector3();
  let maxAngle = 0;

  for (const mesh of meshes) {
    const posAttr = (mesh.geometry as BufferGeometry).getAttribute("position");
    if (!posAttr) continue;
    for (let i = 0; i < posAttr.count; i++) {
      vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      vertex.normalize();
      const angle = Math.acos(
        Math.min(1, Math.max(-1, vertex.dot(normalizedCenter)))
      );
      if (angle > maxAngle) maxAngle = angle;
    }
  }

  return maxAngle;
}

export class PatternRevealAnimation implements Animation {
  private readonly meshes: Mesh[];
  private readonly capitalWorldPos: Vector3;
  private readonly maxRadius: number;
  private readonly duration: number;
  private initialized = false;

  /**
   * @param meshes - Pattern meshes for the country (may be multiple for multi-polygon)
   * @param capitalWorldPos - 3D position of the capital on the unit sphere
   * @param durationMs - Animation duration in milliseconds (default 2700)
   */
  constructor(
    meshes: Mesh[],
    capitalWorldPos: Vector3,
    durationMs = DEFAULT_DURATION
  ) {
    this.meshes = meshes;
    this.capitalWorldPos = capitalWorldPos.clone().normalize();
    // Compute tight radius from actual geometry, with padding and a minimum floor
    const extent = computeAngularExtent(meshes, this.capitalWorldPos);
    this.maxRadius = Math.max(extent + RADIUS_PADDING, MIN_RADIUS);
    this.duration = durationMs;
  }

  update(elapsed: number, _deltaTime: number): boolean {
    // Set reveal center on first frame
    if (!this.initialized) {
      this.initialized = true;
      for (const mesh of this.meshes) {
        const material = mesh.material as ShaderMaterial;
        if (material.uniforms?.u_revealCenter) {
          material.uniforms.u_revealCenter.value.copy(this.capitalWorldPos);
        }
        if (material.uniforms?.u_revealRadius) {
          material.uniforms.u_revealRadius.value = 0.0;
        }
      }
    }

    if (elapsed >= this.duration) {
      // Animation complete — set to fully revealed so the discard check is always skipped
      for (const mesh of this.meshes) {
        const material = mesh.material as ShaderMaterial;
        if (material.uniforms?.u_revealRadius) {
          material.uniforms.u_revealRadius.value = FULLY_REVEALED;
        }
      }
      return false;
    }

    const t = Math.min(elapsed / this.duration, 1.0);
    const radius = easeOutCubic(t) * this.maxRadius;

    for (const mesh of this.meshes) {
      const material = mesh.material as ShaderMaterial;
      if (material.uniforms?.u_revealRadius) {
        material.uniforms.u_revealRadius.value = radius;
      }
    }

    return true;
  }
}
