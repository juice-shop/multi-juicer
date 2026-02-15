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
      u_highlightIntensity: { value: 0.0 },
      u_patternTexture: { value: patternTexture },
      u_patternRotation: { value: Math.PI / 4 }, // 45 degrees
      u_patternScale: { value: 64.0 }, // Adjust for desired repetition (higher = more repetition)
      u_revealCenter: { value: new Vector3(0, 1, 0) },
      u_revealRadius: { value: 999.0 }, // Default: fully revealed
    },

    vertexShader: `
      varying vec3 v_viewPosition;
      varying vec2 v_uv;
      varying vec3 v_worldPosition;

      void main() {
        // Transform to world space
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec3 worldPos = worldPosition.xyz;
        v_worldPosition = worldPos;

        // Transform to view space
        vec4 viewPosition = viewMatrix * worldPosition;
        v_viewPosition = viewPosition.xyz;

        // Calculate UV from spherical coordinates
        // Tilt the coordinate frame ~15° around X-axis so patterns
        // don't align rigidly with geographic poles
        float tiltAngle = 0.26; // ~15 degrees
        float ct = cos(tiltAngle);
        float st = sin(tiltAngle);
        vec3 tilted = vec3(
          worldPos.x,
          worldPos.y * ct - worldPos.z * st,
          worldPos.y * st + worldPos.z * ct
        );
        float radius = length(tilted);
        float lat = asin(tilted.y / radius);
        float lon = atan(tilted.z, tilted.x);

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
      varying vec3 v_worldPosition;

      uniform vec3 u_neonColor;
      uniform float u_glowIntensity;
      uniform float u_hoverIntensity;
      uniform float u_highlightIntensity;
      uniform sampler2D u_patternTexture;
      uniform float u_patternRotation;
      uniform float u_patternScale;
      uniform vec3 u_revealCenter;
      uniform float u_revealRadius;

      void main() {
        // Reveal ring check — skip entirely when fully revealed (radius > PI)
        if (u_revealRadius < 3.14159) {
          float angularDist = acos(clamp(dot(normalize(v_worldPosition), normalize(u_revealCenter)), -1.0, 1.0));
          if (angularDist > u_revealRadius) {
            discard;
          }
        }


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
        vec3 baseColor = mix(normalColor, hoverColor, u_hoverIntensity);

        // Highlight effect - bright warm accent blend
        vec3 highlightColor = vec3(1.0, 0.4, 0.0) * u_glowIntensity * 2.5;
        vec3 color = mix(baseColor, highlightColor, u_highlightIntensity);

        // Ring edge glow — bright leading edge when reveal is active
        if (u_revealRadius < 3.14159) {
          float angularDist = acos(clamp(dot(normalize(v_worldPosition), normalize(u_revealCenter)), -1.0, 1.0));
          float edgeBand = 0.04; // Width of the glow band in radians
          float edgeProximity = smoothstep(u_revealRadius, u_revealRadius - edgeBand, angularDist);
          vec3 ringGlow = vec3(1.0, 0.8, 0.3) * edgeProximity * 3.0;
          color += ringGlow;
        }

        // Blend opacity (highlight forces full opacity)
        float baseOpacity = mix(0.9, 1.0, u_hoverIntensity);
        float finalOpacity = mix(baseOpacity, 1.0, u_highlightIntensity);

        // Output with alpha for blending
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
