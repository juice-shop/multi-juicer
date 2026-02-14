/**
 * Temporary bright glow pulse on a country's pattern material after solve.
 * Animates the u_highlightIntensity uniform: ramp up → hold → fade out.
 */

import type { Mesh, ShaderMaterial } from "three";

import type { Animation } from "../globe-animator";

/** Ease-out cubic */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class CountryHighlightAnimation implements Animation {
  private readonly meshes: Mesh[];
  private readonly rampUpDuration: number;
  private readonly holdDuration: number;
  private readonly fadeOutDuration: number;
  private readonly totalDuration: number;

  /**
   * @param meshes - Pattern meshes for the country (may be multiple for multi-polygon countries)
   * @param rampUpMs - Fast ramp-up duration (default 300ms)
   * @param holdMs - Hold at full intensity (default 1000ms)
   * @param fadeOutMs - Slow fade-out duration (default 1500ms)
   */
  constructor(meshes: Mesh[], rampUpMs = 300, holdMs = 1000, fadeOutMs = 1500) {
    this.meshes = meshes;
    this.rampUpDuration = rampUpMs;
    this.holdDuration = holdMs;
    this.fadeOutDuration = fadeOutMs;
    this.totalDuration = rampUpMs + holdMs + fadeOutMs;
  }

  update(elapsed: number): boolean {
    let intensity: number;

    if (elapsed < this.rampUpDuration) {
      // Phase 1: ramp up
      intensity = easeOutCubic(elapsed / this.rampUpDuration);
    } else if (elapsed < this.rampUpDuration + this.holdDuration) {
      // Phase 2: hold
      intensity = 1.0;
    } else if (elapsed < this.totalDuration) {
      // Phase 3: fade out
      const fadeElapsed = elapsed - this.rampUpDuration - this.holdDuration;
      intensity = 1.0 - easeOutCubic(fadeElapsed / this.fadeOutDuration);
    } else {
      intensity = 0.0;
    }

    // Write the uniform directly — no React re-render
    for (const mesh of this.meshes) {
      const material = mesh.material as ShaderMaterial;
      if (material.uniforms?.u_highlightIntensity) {
        material.uniforms.u_highlightIntensity.value = intensity;
      }
    }

    if (elapsed >= this.totalDuration) {
      // Ensure we leave at 0
      for (const mesh of this.meshes) {
        const material = mesh.material as ShaderMaterial;
        if (material.uniforms?.u_highlightIntensity) {
          material.uniforms.u_highlightIntensity.value = 0.0;
        }
      }
      return false;
    }
    return true;
  }
}
