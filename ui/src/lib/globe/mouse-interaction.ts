import {
  Raycaster,
  Vector2,
  Camera,
  Scene,
  WebGLRenderer,
  Mesh,
  ShaderMaterial,
} from "three";

/**
 * Handles mouse interaction with country meshes on the globe
 * Manages raycasting and hover state for country highlighting
 */
export class MouseInteraction {
  private camera: Camera;
  private renderer: WebGLRenderer;
  private solidMeshes: Mesh[];
  private patternMeshes: Mesh[];
  private raycaster: Raycaster;
  private mouse: Vector2;
  private hoveredMeshes: Map<string, Mesh[]>;
  private currentHoveredCountry: string | null;
  private pointerDownPosition: { x: number; y: number };
  private dragThreshold: number;
  private onCountryHover?: (countryName: string | null) => void;
  private onCountryClick?: (countryName: string) => void;

  constructor(
    camera: Camera,
    _scene: Scene,
    renderer: WebGLRenderer,
    meshArrays: { solid: Mesh[]; pattern: Mesh[] },
    onCountryHover?: (countryName: string | null) => void,
    onCountryClick?: (countryName: string) => void
  ) {
    this.camera = camera;
    this.renderer = renderer;
    this.onCountryHover = onCountryHover;
    this.onCountryClick = onCountryClick;

    // Arrays of meshes to raycast against
    this.solidMeshes = meshArrays.solid;
    this.patternMeshes = meshArrays.pattern;

    // Raycaster setup
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();

    // State tracking
    this.hoveredMeshes = new Map(); // countryName -> [mesh1, mesh2, ...]
    this.currentHoveredCountry = null;

    // Click vs drag detection
    this.pointerDownPosition = { x: 0, y: 0 };
    this.dragThreshold = 5; // pixels - if mouse moves more than this, it's a drag not a click

    // Setup event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("click", this.onClick);
  }

  private onPointerMove = (event: PointerEvent): void => {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check intersections with ALL fillable meshes (solid + pattern)
    const allMeshes = [...this.solidMeshes, ...this.patternMeshes];
    const intersects = this.raycaster.intersectObjects(allMeshes, false);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const hoveredMesh = intersection.object as Mesh;
      const countryName = hoveredMesh.userData.countryName as string;

      // Check if the intersection point is on the visible (front-facing) side of the globe
      // The globe is centered at origin, so we check if the intersection point
      // is on the hemisphere facing the camera
      const toIntersection = intersection.point.clone().normalize();
      const toCamera = this.camera.position.clone().normalize();

      // If the dot product is positive, the intersection is on the visible hemisphere
      const isVisible = toIntersection.dot(toCamera) > 0;

      if (isVisible) {
        // If hovering a different country, update
        if (countryName !== this.currentHoveredCountry) {
          this.clearHover();
          this.setHover(countryName);
        }
        return;
      }
    }

    // No visible intersection found
    this.clearHover();
  };

  private setHover(countryName: string): void {
    this.currentHoveredCountry = countryName;

    // Find ALL meshes for this country (solid + pattern)
    const meshesToHighlight: Mesh[] = [];

    for (const mesh of this.solidMeshes) {
      if (mesh.userData.countryName === countryName) {
        meshesToHighlight.push(mesh);
      }
    }

    for (const mesh of this.patternMeshes) {
      if (mesh.userData.countryName === countryName) {
        meshesToHighlight.push(mesh);
      }
    }

    // Set hover intensity to 1.0 for all meshes of this country
    for (const mesh of meshesToHighlight) {
      const material = mesh.material as ShaderMaterial;
      if (material.uniforms?.u_hoverIntensity) {
        material.uniforms.u_hoverIntensity.value = 1.0;
      }
    }

    this.hoveredMeshes.set(countryName, meshesToHighlight);

    // Change cursor to pointer for visual feedback
    this.renderer.domElement.style.cursor = "pointer";

    // Emit hover event
    this.onCountryHover?.(countryName);
  }

  private clearHover(): void {
    if (!this.currentHoveredCountry) return;

    const meshes = this.hoveredMeshes.get(this.currentHoveredCountry);
    if (meshes) {
      for (const mesh of meshes) {
        const material = mesh.material as ShaderMaterial;
        if (material.uniforms?.u_hoverIntensity) {
          material.uniforms.u_hoverIntensity.value = 0.0;
        }
      }
    }

    this.hoveredMeshes.clear();
    this.currentHoveredCountry = null;
    this.renderer.domElement.style.cursor = "grab";

    // Emit hover clear event
    this.onCountryHover?.(null);
  }

  private onPointerLeave = (): void => {
    this.clearHover();
  };

  private onPointerDown = (event: PointerEvent): void => {
    // Record the position where the pointer was pressed down
    this.pointerDownPosition.x = event.clientX;
    this.pointerDownPosition.y = event.clientY;
  };

  private onClick = (event: MouseEvent): void => {
    // Calculate distance moved since pointerdown
    const deltaX = Math.abs(event.clientX - this.pointerDownPosition.x);
    const deltaY = Math.abs(event.clientY - this.pointerDownPosition.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // If mouse moved more than threshold, it was a drag not a click - ignore it
    if (distance > this.dragThreshold) {
      return;
    }
    // Convert mouse position to normalized device coordinates (-1 to +1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check intersections with ALL fillable meshes (solid + pattern)
    const allMeshes = [...this.solidMeshes, ...this.patternMeshes];
    const intersects = this.raycaster.intersectObjects(allMeshes, false);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const clickedMesh = intersection.object as Mesh;
      const countryName = clickedMesh.userData.countryName as string;

      // Check if the intersection point is on the visible (front-facing) side of the globe
      const toIntersection = intersection.point.clone().normalize();
      const toCamera = this.camera.position.clone().normalize();

      // If the dot product is positive, the intersection is on the visible hemisphere
      const isVisible = toIntersection.dot(toCamera) > 0;

      if (isVisible) {
        // Emit click event
        this.onCountryClick?.(countryName);
      }
    }
  };

  /**
   * Update method called each frame (for future smooth transitions)
   */
  update(): void {
    // Future: Could add smooth interpolation for hover transitions here
  }

  /**
   * Cleanup event listeners
   */
  dispose(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("click", this.onClick);
  }
}
