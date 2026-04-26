import { ShaderMaterial, Vector3, AdditiveBlending, DoubleSide } from "three";

export function createNeonSolidMaterial(
  neonColor: number[],
  glowIntensity: number
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      u_neonColor: { value: new Vector3(...neonColor) },
      u_glowIntensity: { value: glowIntensity },
      u_opacity: { value: 0.15 }, // Subtle background
      u_hoverIntensity: { value: 0.0 }, // 0 = normal, 1 = hovered
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
      uniform float u_opacity;
      uniform float u_hoverIntensity;

      void main() {
        // Base neon color with intensity
        vec3 normalColor = u_neonColor * u_glowIntensity * 0.5;

        // Hover color (much brighter)
        vec3 hoverColor = u_neonColor * u_glowIntensity * 1.5;

        // Blend between normal and hover color
        vec3 color = mix(normalColor, hoverColor, u_hoverIntensity);

        // Blend opacity (0.15 normal -> 0.6 hovered)
        float finalOpacity = mix(u_opacity, 0.6, u_hoverIntensity);

        // Output with alpha for background effect
        gl_FragColor = vec4(color, finalOpacity);
      }
    `,

    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
  });
}
