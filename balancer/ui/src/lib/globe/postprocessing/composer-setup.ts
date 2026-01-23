import { Vector2, WebGLRenderer, Scene, Camera } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/**
 * Setup post-processing pipeline with neon glow effect
 * Uses UnrealBloomPass for efficient bloom rendering
 */
export function setupComposer(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera
): EffectComposer {
  const composer = new EffectComposer(renderer);

  // 1. Render scene to texture
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Add neon glow effect using UnrealBloomPass
  const bloomPass = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    0.1, // strength - very low for debugging
    0.2, // radius - minimal spread
    0.95 // threshold - much higher to barely glow
  );
  bloomPass.renderToScreen = true;
  composer.addPass(bloomPass);

  return composer;
}
