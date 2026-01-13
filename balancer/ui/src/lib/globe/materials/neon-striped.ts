/**
 * @deprecated This shader has been replaced by neon-pattern.ts
 * which uses team-specific pattern textures instead of GLSL stripes.
 * Kept for backwards compatibility only.
 */

import { ShaderMaterial, Vector3, AdditiveBlending, DoubleSide } from "three";

export function createNeonStripedMaterial(
  neonColor: number[],
  glowIntensity: number
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      u_neonColor: { value: new Vector3(...neonColor) },
      u_glowIntensity: { value: glowIntensity },
      u_hoverIntensity: { value: 0.0 }, // 0 = normal, 1 = hovered
    },

    vertexShader: `
      varying vec3 v_worldPosition;
      varying vec3 v_viewPosition;

      void main() {
        // Transform to world space
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        v_worldPosition = worldPosition.xyz;

        // Transform to view space
        vec4 viewPosition = viewMatrix * worldPosition;
        v_viewPosition = viewPosition.xyz;

        // Transform to clip space
        gl_Position = projectionMatrix * viewPosition;
      }
    `,

    fragmentShader: `
      precision mediump float;

      varying vec3 v_worldPosition;
      varying vec3 v_viewPosition;

      uniform vec3 u_neonColor;
      uniform float u_glowIntensity;
      uniform float u_hoverIntensity;

      void main() {
        // Calculate distance from camera for depth-based effects
        float dist = length(v_viewPosition);

        // Depth-based fade (closer = brighter)
        float depthFade = smoothstep(6.0, 2.0, dist);

        // Create diagonal stripe pattern using spherical coordinates
        // This wraps properly around the globe without convergence points
        float radius = length(v_worldPosition);

        // Calculate latitude and longitude
        float lat = asin(v_worldPosition.z / radius);
        float lon = atan(v_worldPosition.y, v_worldPosition.x);

        // Create diagonal stripes by combining lat + lon
        float stripeFrequency = 24.0; // Adjust for stripe density
        float diagonal = lat + lon;
        float stripe = mod(floor(diagonal * stripeFrequency), 2.0);

        // Only render every other stripe (creates gaps)
        if (stripe < 0.5) {
          discard;
        }

        // Base neon color with intensity boost
        vec3 normalColor = u_neonColor * u_glowIntensity;

        // Hover color (much brighter)
        vec3 hoverColor = u_neonColor * u_glowIntensity * 1.8;

        // Blend between normal and hover color
        vec3 color = mix(normalColor, hoverColor, u_hoverIntensity);

        // Final color with depth fade
        vec3 finalColor = color * depthFade;

        // Blend opacity (0.9 normal -> 1.0 hovered for more brightness)
        float finalOpacity = mix(0.9, 1.0, u_hoverIntensity);

        // Output with alpha for blending
        gl_FragColor = vec4(finalColor, depthFade * finalOpacity);
      }
    `,

    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
  });
}
