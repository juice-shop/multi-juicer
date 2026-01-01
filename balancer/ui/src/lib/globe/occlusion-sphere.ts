import { SphereGeometry, MeshBasicMaterial, Mesh, FrontSide } from "three";

export function createOcclusionSphere(radius: number = 0.99): Mesh {
  const geometry = new SphereGeometry(radius, 32, 32);
  const material = new MeshBasicMaterial({
    color: 0x000000,
    side: FrontSide,
    depthWrite: true,
  });

  return new Mesh(geometry, material);
}
