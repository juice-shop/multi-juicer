import {
  ShaderMaterial,
  Vector3,
  AdditiveBlending,
  DoubleSide,
  Texture,
} from "three";

export function createNeonPatternMaterial(
  neonColor: number[],
  glowIntensity: number,
  patternTexture: Texture
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      u_neonColor: { value: new Vector3(...neonColor) },
      u_glowIntensity: { value: glowIntensity },
      u_hoverIntensity: { value: 0.0 },
      u_patternTexture: { value: patternTexture },
      u_patternRotation: { value: Math.PI / 4 }, // 45 degrees
      u_patternScale: { value: 64.0 }, // Adjust for desired repetition (higher = more repetition)
    },

    vertexShader: `
      varying vec3 v_viewPosition;
      varying vec2 v_uv;

      void main() {
        // Transform to world space
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec3 worldPos = worldPosition.xyz;

        // Transform to view space
        vec4 viewPosition = viewMatrix * worldPosition;
        v_viewPosition = viewPosition.xyz;

        // Calculate UV from spherical coordinates
        float radius = length(worldPos);
        float lat = asin(worldPos.z / radius);
        float lon = atan(worldPos.y, worldPos.x);

        // Normalize to 0-1 range
        v_uv = vec2(
          (lon + 3.14159) / (2.0 * 3.14159),
          (lat + 1.5708) / 3.14159
        );

        // Transform to clip space
        gl_Position = projectionMatrix * viewPosition;
      }
    `,

    fragmentShader: `
      precision mediump float;

      varying vec3 v_viewPosition;
      varying vec2 v_uv;

      uniform vec3 u_neonColor;
      uniform float u_glowIntensity;
      uniform float u_hoverIntensity;
      uniform sampler2D u_patternTexture;
      uniform float u_patternRotation;
      uniform float u_patternScale;

      void main() {
        // Calculate distance from camera for depth-based effects
        float dist = length(v_viewPosition);
        float depthFade = smoothstep(6.0, 2.0, dist);

        // Apply rotation matrix to UV coordinates (45-degree rotation)
        vec2 centeredUV = (v_uv - 0.5) * u_patternScale;
        float cosR = cos(u_patternRotation);
        float sinR = sin(u_patternRotation);
        vec2 rotatedUV = vec2(
          centeredUV.x * cosR - centeredUV.y * sinR,
          centeredUV.x * sinR + centeredUV.y * cosR
        );

        // Sample pattern texture
        vec4 pattern = texture2D(u_patternTexture, rotatedUV);

        // Use pattern luminance as mask (dark areas are discarded)
        float luminance = (pattern.r + pattern.g + pattern.b) / 3.0;
        if (luminance < 0.5) {
          discard;
        }

        // Base neon color with intensity boost
        vec3 normalColor = u_neonColor * u_glowIntensity;
        vec3 hoverColor = u_neonColor * u_glowIntensity * 1.8;

        // Blend between normal and hover color
        vec3 color = mix(normalColor, hoverColor, u_hoverIntensity);

        // Final color with depth fade
        vec3 finalColor = color * depthFade;

        // Blend opacity
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
