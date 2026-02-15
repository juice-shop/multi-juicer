import { ShaderMaterial, Vector3, AdditiveBlending } from "three";

export function createNeonWireframeMaterial(
  neonColor: number[],
  glowIntensity: number
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      u_neonColor: { value: new Vector3(...neonColor) },
      u_glowIntensity: { value: glowIntensity },
      u_cameraPosition: { value: new Vector3() },
    },

    vertexShader: `
      varying vec3 v_viewPosition;

      void main() {
        // Transform to world space
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);

        // Transform to view space
        vec4 viewPosition = viewMatrix * worldPosition;
        v_viewPosition = viewPosition.xyz;

        // Transform to clip space
        gl_Position = projectionMatrix * viewPosition;
      }
    `,

    fragmentShader: `
      precision mediump float;

      varying vec3 v_viewPosition;

      uniform vec3 u_neonColor;
      uniform float u_glowIntensity;
      uniform vec3 u_cameraPosition;

      void main() {
        // Base neon color with intensity boost
        vec3 color = u_neonColor * u_glowIntensity;

        // Output with alpha for blending
        gl_FragColor = vec4(color, 0.9);
      }
    `,

    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
}
