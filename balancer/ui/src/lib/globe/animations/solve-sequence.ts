/**
 * Composite animation that sequences camera focus + material transition + highlight.
 *
 * Timeline:
 *   0–1500ms: Camera rotates to face the country
 *   1000–1500ms: Transition solid → pattern material (overlaps with camera arrival)
 *   1500–4300ms: Country highlight glow pulse
 */

import type { PerspectiveCamera, Mesh, Vector3 } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { Animation } from "../globe-animator";
import type { GlobeRenderer } from "../globe-renderer";

import { CameraFocusAnimation } from "./camera-focus";
import { CountryHighlightAnimation } from "./country-highlight";

/** Timing constants (milliseconds) */
const CAMERA_DURATION = 1500;
const TRANSITION_START = 1000;
const HIGHLIGHT_START = 1500;

interface SolveSequenceParams {
  countryName: string;
  patternIndex: number;
  targetPosition: Vector3;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  globeRenderer: GlobeRenderer;
  themeColors: { primary: number[]; glowIntensity: number };
}

export class SolveSequenceAnimation implements Animation {
  private readonly params: SolveSequenceParams;
  private cameraAnim: CameraFocusAnimation | null = null;
  private highlightAnim: CountryHighlightAnimation | null = null;
  private transitioned = false;
  private highlightStartTime = 0;
  private done = false;

  constructor(params: SolveSequenceParams) {
    this.params = params;
  }

  update(elapsed: number, deltaTime: number): boolean {
    if (this.done) return false;

    // Phase 1: Start camera animation on first frame
    if (!this.cameraAnim) {
      this.cameraAnim = new CameraFocusAnimation(
        this.params.camera,
        this.params.controls,
        this.params.targetPosition,
        CAMERA_DURATION
      );
    }

    // Drive camera animation
    if (this.cameraAnim) {
      const cameraRunning = this.cameraAnim.update(elapsed, deltaTime);
      if (!cameraRunning) {
        this.cameraAnim = null;
      }
    }

    // Phase 2: Transition material at TRANSITION_START
    if (!this.transitioned && elapsed >= TRANSITION_START) {
      this.transitioned = true;
      this.params.globeRenderer
        .transitionCountryToSolved(
          this.params.countryName,
          this.params.patternIndex,
          this.params.themeColors
        )
        .catch((error) => {
          console.error(
            `Failed to transition ${this.params.countryName}:`,
            error
          );
        });
    }

    // Phase 3: Start highlight at HIGHLIGHT_START
    if (!this.highlightAnim && elapsed >= HIGHLIGHT_START) {
      // Find the pattern meshes that were just created
      const patternMeshes = this.params.globeRenderer.patternMeshes.filter(
        (mesh: Mesh) => mesh.name === this.params.countryName
      );
      if (patternMeshes.length > 0) {
        this.highlightAnim = new CountryHighlightAnimation(patternMeshes);
        this.highlightStartTime = elapsed;
      }
    }

    // Drive highlight animation
    if (this.highlightAnim) {
      const highlightElapsed = elapsed - this.highlightStartTime;
      const highlightRunning = this.highlightAnim.update(
        highlightElapsed,
        deltaTime
      );
      if (!highlightRunning) {
        this.highlightAnim = null;
        this.done = true;
        return false;
      }
    }

    // If no highlight was started (no pattern meshes found) and camera is done,
    // finish after a generous timeout
    if (
      !this.highlightAnim &&
      !this.cameraAnim &&
      elapsed > HIGHLIGHT_START + 500
    ) {
      this.done = true;
      return false;
    }

    return true;
  }
}
