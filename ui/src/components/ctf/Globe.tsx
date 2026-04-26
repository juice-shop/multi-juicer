import { memo, useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Scene, Color, PerspectiveCamera, WebGLRenderer, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";

import { SolveSequenceAnimation } from "@/lib/globe/animations/solve-sequence";
import type { CountryGeometryManager } from "@/lib/globe/country-geometry";
import type { CountryData } from "@/lib/globe/data/geojson-loader";
import { GlobeAnimator } from "@/lib/globe/globe-animator";
import { GlobeRenderer } from "@/lib/globe/globe-renderer";
import {
  latLonToSphere,
  greatCircleDistance,
} from "@/lib/globe/math/projection";
import { MouseInteraction } from "@/lib/globe/mouse-interaction";
import { createOcclusionSphere } from "@/lib/globe/occlusion-sphere";
import { setupComposer } from "@/lib/globe/postprocessing/composer-setup";

interface ThemeColors {
  primary: number[];
  accent: number[];
  secondary: number[];
  glowIntensity: number;
}

/** Imperative handle for controlling the globe without React re-renders */
export interface GlobeHandle {
  /** Transition a country from solid fill to pattern fill */
  transitionCountryToSolved(
    countryName: string,
    patternPath: string
  ): Promise<void>;
  /** Rotate camera to the country, transition material, and pulse a highlight glow */
  focusAndHighlightCountry(countryName: string, patternPath: string): void;
  /**
   * Enqueue multiple solve animations, sorted by geographic proximity
   * (greedy nearest-neighbor from the current camera position) so the camera
   * traces a short path instead of jumping randomly around the globe.
   */
  focusAndHighlightCountries(
    solves: Array<{ countryName: string; patternPath: string }>
  ): void;
}

interface GlobeProps {
  countries: CountryData[];
  geometryManager: CountryGeometryManager;
  themeColors: ThemeColors;
  onStatsUpdate?: (fps: number, vertexCount: number) => void;
  onCountryHover?: (countryName: string | null) => void;
  onCountryClick?: (countryName: string) => void;
  /** Called when the globe is ready with an imperative handle */
  onGlobeReady?: (handle: GlobeHandle) => void;
}

function GlobeInternal({
  countries,
  geometryManager,
  themeColors,
  onStatsUpdate,
  onCountryHover,
  onCountryClick,
  onGlobeReady,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Store refs for values needed in imperative updates
  const themeColorsRef = useRef(themeColors);
  const onCountryHoverRef = useRef(onCountryHover);
  const onCountryClickRef = useRef(onCountryClick);
  const onStatsUpdateRef = useRef(onStatsUpdate);
  const onGlobeReadyRef = useRef(onGlobeReady);

  // Keep refs updated
  useEffect(() => {
    themeColorsRef.current = themeColors;
  }, [themeColors]);

  useEffect(() => {
    onCountryHoverRef.current = onCountryHover;
  }, [onCountryHover]);

  useEffect(() => {
    onCountryClickRef.current = onCountryClick;
  }, [onCountryClick]);

  useEffect(() => {
    onStatsUpdateRef.current = onStatsUpdate;
  }, [onStatsUpdate]);

  useEffect(() => {
    onGlobeReadyRef.current = onGlobeReady;
  }, [onGlobeReady]);

  // Main initialization - runs ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    let animationFrameId: number;
    let isRunning = true;
    let scene: Scene;
    let camera: PerspectiveCamera;
    let renderer: WebGLRenderer;
    let controls: OrbitControls;
    let composer: EffectComposer;
    let globeRenderer: GlobeRenderer;
    let mouseInteraction: MouseInteraction;
    let animator: GlobeAnimator;

    const stats = {
      fps: 0,
      frameTime: 0,
      vertexCount: geometryManager.totalVertexCount,
    };
    let lastFrameTime = 0;

    async function init() {
      try {
        // 1. Create scene
        scene = new Scene();
        scene.background = new Color(0x020202);

        // 2. Create camera
        camera = new PerspectiveCamera(
          45,
          window.innerWidth / window.innerHeight,
          0.1,
          100
        );
        camera.position.set(0, 0, 3);

        // 3. Create renderer
        renderer = new WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        if (!containerRef.current) {
          throw new Error("Canvas container element not found");
        }
        containerRef.current.appendChild(renderer.domElement);

        // Add WebGL context loss/restore handlers
        const canvas = renderer.domElement;
        const handleContextLost = (event: Event) => {
          event.preventDefault();
          console.warn("WebGL context lost. Pausing render loop...");
          isRunning = false;
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
        };

        const handleContextRestored = () => {
          console.log("WebGL context restored. Resuming render loop...");
          isRunning = true;
          lastFrameTime = performance.now();
          animationFrameId = requestAnimationFrame(render);
        };

        canvas.addEventListener("webglcontextlost", handleContextLost);
        canvas.addEventListener("webglcontextrestored", handleContextRestored);

        // 4. Setup controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 2.5;
        controls.maxDistance = 6;
        controls.minZoom = 2.5;
        controls.maxZoom = 6;
        controls.enablePan = false;
        controls.autoRotate = false;
        controls.autoRotateSpeed = 0.5;

        // 5. Create occlusion sphere
        const occlusionSphere = createOcclusionSphere(0.999);
        scene.add(occlusionSphere);

        // 6. Create globe renderer with pre-computed data
        globeRenderer = new GlobeRenderer(scene);
        await globeRenderer.initialize(geometryManager, themeColors, countries);

        // 6b. Create animation manager
        animator = new GlobeAnimator();

        // 7. Setup mouse interaction for country hover effects
        mouseInteraction = new MouseInteraction(
          camera,
          scene,
          renderer,
          {
            solid: globeRenderer.solidMeshes,
            pattern: globeRenderer.patternMeshes,
          },
          (countryName) => onCountryHoverRef.current?.(countryName),
          (countryName) => onCountryClickRef.current?.(countryName)
        );

        // 7b. Create imperative handle and notify parent
        const handle: GlobeHandle = {
          transitionCountryToSolved: async (
            countryName: string,
            patternPath: string
          ) => {
            const colors = themeColorsRef.current;
            await globeRenderer.transitionCountryToSolved(
              countryName,
              patternPath,
              {
                primary: colors.primary,
                glowIntensity: colors.glowIntensity,
              }
            );
          },
          focusAndHighlightCountry: (
            countryName: string,
            patternPath: string
          ) => {
            const center = globeRenderer.getCountryCenter(countryName);
            if (!center) {
              // Fallback: just do the material transition without animation
              const colors = themeColorsRef.current;
              globeRenderer
                .transitionCountryToSolved(countryName, patternPath, {
                  primary: colors.primary,
                  glowIntensity: colors.glowIntensity,
                })
                .catch(console.error);
              return;
            }

            const targetPos = latLonToSphere(center.lon, center.lat, 1.0);
            const colors = themeColorsRef.current;

            const capitalWorld = new Vector3(
              targetPos.x,
              targetPos.y,
              targetPos.z
            );

            animator.enqueue(
              new SolveSequenceAnimation({
                countryName,
                patternPath,
                targetPosition: capitalWorld,
                capitalWorldPos: capitalWorld,
                camera,
                controls,
                globeRenderer,
                themeColors: {
                  primary: colors.primary,
                  glowIntensity: colors.glowIntensity,
                },
              })
            );
          },
          focusAndHighlightCountries: (
            solves: Array<{ countryName: string; patternPath: string }>
          ) => {
            if (solves.length === 0) return;

            // Resolve centers for all solves, separate those without geo data
            type SolveWithCenter = {
              countryName: string;
              patternPath: string;
              lat: number;
              lon: number;
            };
            const withCenter: SolveWithCenter[] = [];
            for (const s of solves) {
              const center = globeRenderer.getCountryCenter(s.countryName);
              if (center) {
                withCenter.push({ ...s, lat: center.lat, lon: center.lon });
              } else {
                // No geo data — transition immediately without animation
                const colors = themeColorsRef.current;
                globeRenderer
                  .transitionCountryToSolved(s.countryName, s.patternPath, {
                    primary: colors.primary,
                    glowIntensity: colors.glowIntensity,
                  })
                  .catch(console.error);
              }
            }

            if (withCenter.length === 0) return;

            // Sort by geographic proximity (greedy nearest-neighbor from camera)
            // Convert current camera position to lat/lon
            const camPos = camera.position;
            const camR = camPos.length();
            let curLat = 90 - Math.acos(camPos.y / camR) * (180 / Math.PI);
            let curLon = 90 - Math.atan2(camPos.z, camPos.x) * (180 / Math.PI);

            const remaining = [...withCenter];
            const sorted: SolveWithCenter[] = [];

            while (remaining.length > 0) {
              let bestIdx = 0;
              let bestDist = Infinity;
              for (let i = 0; i < remaining.length; i++) {
                const d = greatCircleDistance(
                  curLon,
                  curLat,
                  remaining[i].lon,
                  remaining[i].lat
                );
                if (d < bestDist) {
                  bestDist = d;
                  bestIdx = i;
                }
              }
              const chosen = remaining.splice(bestIdx, 1)[0];
              sorted.push(chosen);
              curLat = chosen.lat;
              curLon = chosen.lon;
            }

            // Enqueue animations in proximity order
            const colors = themeColorsRef.current;
            for (const s of sorted) {
              const targetPos = latLonToSphere(s.lon, s.lat, 1.0);
              const capitalWorld = new Vector3(
                targetPos.x,
                targetPos.y,
                targetPos.z
              );
              animator.enqueue(
                new SolveSequenceAnimation({
                  countryName: s.countryName,
                  patternPath: s.patternPath,
                  targetPosition: capitalWorld,
                  capitalWorldPos: capitalWorld,
                  camera,
                  controls,
                  globeRenderer,
                  themeColors: {
                    primary: colors.primary,
                    glowIntensity: colors.glowIntensity,
                  },
                })
              );
            }
          },
        };
        onGlobeReadyRef.current?.(handle);

        // 8. Setup post-processing
        composer = setupComposer(renderer, scene, camera);

        // 9. Handle window resize
        const handleResize = () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
          composer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);

        // 10. Start render loop
        isRunning = true;
        lastFrameTime = performance.now();

        let lastActivityTime = performance.now();
        const IDLE_TIMEOUT = 10_000;
        const DEFAULT_CAMERA_DISTANCE = 3;

        // Reset activity timer on user interaction (drag, scroll, touch)
        controls.addEventListener("start", () => {
          lastActivityTime = performance.now();
          controls.autoRotate = false;
          controls.minPolarAngle = 0;
          controls.maxPolarAngle = Math.PI;
        });

        function render(currentTime: number) {
          if (!isRunning) return;

          const deltaTime = currentTime - lastFrameTime;
          lastFrameTime = currentTime;

          // Update stats
          stats.frameTime = deltaTime;
          stats.fps = Math.round(1000 / deltaTime);

          // Auto-rotate after idle timeout
          if (!animator.isIdle) {
            lastActivityTime = currentTime;
            controls.autoRotate = false;
            // Unlock polar angle so camera can reach any latitude
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI;
          } else if (currentTime - lastActivityTime > IDLE_TIMEOUT) {
            controls.autoRotate = true;

            // Slowly drift the camera back toward the equator (polarAngle = π/2)
            // so auto-rotation doesn't look awkward near the poles
            // Slightly above equator (~20° north) to keep more landmass in view
            const EQUATOR_ANGLE = Math.PI / 2 - 0.35;
            const polarAngle = controls.getPolarAngle();
            const diff = EQUATOR_ANGLE - polarAngle;
            if (Math.abs(diff) > 0.01) {
              const DRIFT_SPEED = 0.003;
              const step = diff * DRIFT_SPEED;
              controls.minPolarAngle = polarAngle + step;
              controls.maxPolarAngle = polarAngle + step;
            } else {
              controls.minPolarAngle = EQUATOR_ANGLE;
              controls.maxPolarAngle = EQUATOR_ANGLE;
            }

            // Slowly drift the camera distance back to the default
            const currentDistance = camera.position.length();
            const distDiff = DEFAULT_CAMERA_DISTANCE - currentDistance;
            if (Math.abs(distDiff) > 0.01) {
              const DISTANCE_DRIFT_SPEED = 0.003;
              const distStep = distDiff * DISTANCE_DRIFT_SPEED;
              const newDistance = currentDistance + distStep;
              camera.position.normalize().multiplyScalar(newDistance);
            } else if (Math.abs(distDiff) > 0.001) {
              camera.position
                .normalize()
                .multiplyScalar(DEFAULT_CAMERA_DISTANCE);
            }
          } else {
            // Free look — allow full polar range
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI;
          }

          // Update controls
          controls.update();

          // Drive queued animations (camera focus, highlights, etc.)
          animator.update(deltaTime, currentTime);

          // Update material uniforms
          globeRenderer.updateUniforms(camera.position);

          // Render with post-processing
          composer.render();

          // Update stats display
          onStatsUpdateRef.current?.(stats.fps, stats.vertexCount);

          animationFrameId = requestAnimationFrame(render);
        }

        animationFrameId = requestAnimationFrame(render);

        console.log("Globe initialized successfully");
        console.log(`Rendering ${stats.vertexCount.toLocaleString()} vertices`);

        // Handle visibility change (pause when tab is hidden)
        const handleVisibilityChange = () => {
          if (document.hidden) {
            isRunning = false;
            if (animationFrameId) {
              cancelAnimationFrame(animationFrameId);
            }
          } else {
            isRunning = true;
            lastFrameTime = performance.now();
            animationFrameId = requestAnimationFrame(render);
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Cleanup function
        return () => {
          isRunning = false;
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          window.removeEventListener("resize", handleResize);
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange
          );

          // Remove WebGL context event listeners
          const canvas = renderer?.domElement;
          if (canvas) {
            canvas.removeEventListener("webglcontextlost", handleContextLost);
            canvas.removeEventListener(
              "webglcontextrestored",
              handleContextRestored
            );
          }

          // Dispose resources
          mouseInteraction?.dispose();
          controls?.dispose();
          composer?.dispose();
          renderer?.dispose();

          if (containerRef.current && renderer?.domElement) {
            containerRef.current.removeChild(renderer.domElement);
          }
        };
      } catch (error) {
        console.error("Initialization error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        setError(errorMessage);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, geometryManager]);

  if (error) {
    return (
      <div className="fixed top-0 left-0 w-screen h-screen bg-ctf-bg flex flex-col items-center justify-center z-1000 transition-opacity duration-500">
        <div
          className="text-xl tracking-[4px] uppercase mb-8 text-red-500"
          style={{
            textShadow: "0 0 10px #FF0000, 0 0 20px #FF0000",
          }}
        >
          <FormattedMessage
            id="ctf.globe.error"
            defaultMessage="ERROR: {error}"
            values={{ error }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      id="canvas-container"
      className="fixed top-0 left-0 w-screen h-screen [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:cursor-grab [&>canvas]:touch-none [&>canvas:active]:cursor-grabbing"
      ref={containerRef}
    />
  );
}

/**
 * Globe component wrapped in React.memo with custom comparison.
 * Only re-renders if core data changes (countries, geometryManager, themeColors).
 * Callbacks are intentionally ignored since they read from refs internally.
 */
export const Globe = memo(GlobeInternal, (prev, next) => {
  return (
    prev.countries === next.countries &&
    prev.geometryManager === next.geometryManager &&
    prev.themeColors === next.themeColors
  );
});
