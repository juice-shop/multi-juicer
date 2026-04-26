/**
 * Smoothly rotates the camera to face a target country on the globe.
 * Works with OrbitControls by slerping camera position on the spherical shell.
 */

import { Vector3 } from "three";
import type { PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { Animation } from "../globe-animator";

/** Ease-in-out cubic */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CameraFocusAnimation implements Animation {
  private readonly duration: number;
  private readonly startPos: Vector3;
  private readonly targetPos: Vector3;
  private readonly startRadius: number;
  private readonly targetRadius: number;
  private readonly controls: OrbitControls;
  private readonly camera: PerspectiveCamera;
  private wasRotateEnabled: boolean;

  /**
   * @param camera - The perspective camera to animate
   * @param controls - OrbitControls instance (rotation disabled during animation)
   * @param targetPosition - 3D position on the sphere surface to face
   * @param duration - Animation duration in milliseconds (default 1500)
   * @param targetRadius - Target camera distance from origin (default: zoom in to minDistance)
   */
  constructor(
    camera: PerspectiveCamera,
    controls: OrbitControls,
    targetPosition: Vector3,
    duration = 1500,
    targetRadius?: number
  ) {
    this.camera = camera;
    this.controls = controls;
    this.duration = duration;
    this.startPos = camera.position.clone();
    this.startRadius = camera.position.length();
    this.targetRadius = targetRadius ?? controls.minDistance;

    // Compute the target camera position direction (unit vector toward target)
    this.targetPos = targetPosition
      .clone()
      .normalize()
      .multiplyScalar(this.startRadius);

    // Disable user rotation during animation
    this.wasRotateEnabled = controls.enableRotate;
    controls.enableRotate = false;
  }

  update(elapsed: number, _deltaTime: number): boolean {
    const t = Math.min(elapsed / this.duration, 1);
    const eased = easeInOutCubic(t);

    // Slerp between start and target positions (maintains radius on sphere)
    const current = new Vector3()
      .copy(this.startPos)
      .lerp(this.targetPos, eased);

    // Interpolate radius between start and target distance
    const radius =
      this.startRadius + (this.targetRadius - this.startRadius) * eased;
    current.normalize().multiplyScalar(radius);

    this.camera.position.copy(current);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();

    if (t >= 1) {
      // Re-enable user rotation
      this.controls.enableRotate = this.wasRotateEnabled;
      return false;
    }
    return true;
  }
}
