import { useEffect, useRef, useState } from "react";
import { Scene, Color, PerspectiveCamera, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";

import type { CountryGeometryManager } from "@/lib/globe/country-geometry";
import type { CountryData } from "@/lib/globe/data/geojson-loader";
import { GlobeRenderer } from "@/lib/globe/globe-renderer";
import { MouseInteraction } from "@/lib/globe/mouse-interaction";
import { createOcclusionSphere } from "@/lib/globe/occlusion-sphere";
import { setupComposer } from "@/lib/globe/postprocessing/composer-setup";

interface ThemeColors {
  primary: number[];
  accent: number[];
  secondary: number[];
  glowIntensity: number;
}

interface GlobeProps {
  countries: CountryData[];
  geometryManager: CountryGeometryManager;
  themeColors: ThemeColors;
  onStatsUpdate?: (fps: number, vertexCount: number) => void;
  onCountryHover?: (countryName: string | null) => void;
  onCountryClick?: (countryName: string) => void;
}

export function Globe({
  countries,
  geometryManager,
  themeColors,
  onStatsUpdate,
  onCountryHover,
  onCountryClick,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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

    const stats = {
      fps: 0,
      frameTime: 0,
      vertexCount: geometryManager.totalVertexCount,
    };
    let lastFrameTime = 0;

    async function init() {
      try {
        console.log("Initializing Globe with pre-computed data...");

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
        controls.maxDistance = 5;
        controls.minZoom = 2.5;
        controls.maxZoom = 5;
        controls.enablePan = false;

        // 5. Create occlusion sphere
        const occlusionSphere = createOcclusionSphere(0.999);
        scene.add(occlusionSphere);

        // 6. Create globe renderer with pre-computed data
        globeRenderer = new GlobeRenderer(
          scene,
          geometryManager,
          themeColors,
          countries
        );

        // 7. Setup mouse interaction for country hover effects
        mouseInteraction = new MouseInteraction(
          camera,
          scene,
          renderer,
          {
            solid: globeRenderer.solidMeshes,
            striped: globeRenderer.stripedMeshes,
          },
          onCountryHover,
          onCountryClick
        );

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

        function render(currentTime: number) {
          if (!isRunning) return;

          const deltaTime = currentTime - lastFrameTime;
          lastFrameTime = currentTime;

          // Update stats
          stats.frameTime = deltaTime;
          stats.fps = Math.round(1000 / deltaTime);

          // Update controls
          controls.update();

          // Update material uniforms
          globeRenderer.updateUniforms(camera.position);

          // Render with post-processing
          composer.render();

          // Update stats display
          onStatsUpdate?.(stats.fps, stats.vertexCount);

          animationFrameId = requestAnimationFrame(render);
        }

        animationFrameId = requestAnimationFrame(render);

        console.log("Globe initialized successfully");
        console.log(`Rendering ${stats.vertexCount.toLocaleString()} vertices`);

        // Handle visibility change (pause when tab is hidden)
        const handleVisibilityChange = () => {
          if (document.hidden) {
            console.log("Tab hidden - pausing render loop");
            isRunning = false;
            if (animationFrameId) {
              cancelAnimationFrame(animationFrameId);
            }
          } else {
            console.log("Tab visible - resuming render loop");
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
  }, [
    countries,
    geometryManager,
    themeColors,
    onStatsUpdate,
    onCountryHover,
    onCountryClick,
  ]);

  if (error) {
    return (
      <div className="fixed top-0 left-0 w-screen h-screen bg-ctf-bg flex flex-col items-center justify-center z-[1000] transition-opacity duration-500">
        <div
          className="text-xl tracking-[4px] uppercase mb-8 animate-pulse text-red-500"
          style={{
            textShadow: "0 0 10px #FF0000, 0 0 20px #FF0000",
          }}
        >
          ERROR: {error}
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
