/**
 * GLSL for the WEJI bloom.
 *
 * Kept as plain strings rather than a shader-loader setup: there are only three
 * programs, and this way the build needs no extra tooling.
 */

/**
 * A picture tile. The plane curls back at its edges in proportion to how fast
 * the bloom is spinning, so pictures read as cards pushing through air rather
 * than stickers sliding on glass.
 */
export const tileVertex = /* glsl */ `
  uniform float uBend;
  uniform float uHover;
  uniform float uTime;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vUv = uv;
    vec3 p = position;
    float x = uv.x - 0.5;
    float bend = abs(uBend);

    // Edges fall away from the viewer; the centre stays put.
    p.z -= bend * 1.25 * (x * x * 4.0);
    // A slow ripple along the length while in motion.
    p.z += sin(uv.y * 3.14159 + uTime * 2.4) * 0.05 * bend;
    // Hovered tiles lift toward the viewer.
    p.z += uHover * 0.35;

    // Curled edges catch less light.
    vShade = 1.0 - bend * 0.45 * abs(x) * 2.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const tileFragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uTexMix;
  uniform vec2 uPlane;
  uniform vec2 uImage;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uHover;
  uniform float uSplit;
  uniform float uRadius;
  varying vec2 vUv;
  varying float vShade;

  // object-fit: cover, in shader form.
  vec2 coverUv(vec2 uv) {
    float planeRatio = uPlane.x / uPlane.y;
    float imageRatio = uImage.x / max(uImage.y, 1.0);
    vec2 scale = planeRatio < imageRatio
      ? vec2(planeRatio / imageRatio, 1.0)
      : vec2(1.0, imageRatio / planeRatio);
    return (uv - 0.5) * scale + 0.5;
  }

  // Rounded-rectangle signed distance, in world units.
  float roundedMask(vec2 uv) {
    vec2 p = (uv - 0.5) * uPlane;
    vec2 b = uPlane * 0.5 - vec2(uRadius);
    float d = length(max(abs(p) - b, 0.0)) - uRadius;
    return 1.0 - smoothstep(-0.012, 0.012, d);
  }

  void main() {
    float mask = roundedMask(vUv);
    if (mask < 0.01) discard;

    vec2 uv = coverUv(vUv);
    // Chromatic split grows with speed: the energy of a fast flick.
    vec2 offset = vec2(uSplit, 0.0);
    vec3 picture = vec3(
      texture2D(uTex, uv + offset).r,
      texture2D(uTex, uv).g,
      texture2D(uTex, uv - offset).b
    );
    vec3 color = mix(uColor, picture, uTexMix) * vShade;

    // Hover: brighten and add a warm rim of saffron light.
    vec2 edge = abs(vUv - 0.5) * 2.0;
    float rim = smoothstep(0.82, 1.0, max(edge.x, edge.y));
    color += uHover * (0.07 + rim * vec3(1.0, 0.62, 0.22) * 0.55);

    gl_FragColor = vec4(color, mask * uAlpha);
    #include <colorspace_fragment>
  }
`;

/**
 * Full-screen backdrop drawn behind everything: night-indigo with drifting
 * pools of saffron, violet and coral light, tinted toward whatever picture the
 * viewer is looking at. Writes display colours directly, so it deliberately
 * skips the colour-space conversion the tiles use.
 */
export const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

export const backdropFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec3 uTint;
  uniform float uTintMix;
  varying vec2 vUv;

  float pool(vec2 p, vec2 c, float r) {
    vec2 d = p - c;
    return exp(-dot(d, d) / (r * r));
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(vUv.x * aspect, vUv.y);
    vec3 night = vec3(0.027, 0.024, 0.055);
    vec3 color = night;

    vec2 saffronAt = vec2((0.22 + 0.06 * sin(uTime * 0.13)) * aspect, 0.80 + 0.05 * cos(uTime * 0.11));
    vec2 violetAt  = vec2((0.84 + 0.05 * cos(uTime * 0.09)) * aspect, 0.18 + 0.06 * sin(uTime * 0.12));
    vec2 coralAt   = vec2(0.50 * aspect, 0.48 + 0.04 * sin(uTime * 0.07));

    color += vec3(1.00, 0.70, 0.25) * 0.22 * pool(p, saffronAt, 0.50);
    color += vec3(0.48, 0.36, 1.00) * 0.26 * pool(p, violetAt, 0.62);
    color += vec3(1.00, 0.30, 0.43) * 0.12 * pool(p, coralAt, 0.38);

    // The scene takes on the colour of the picture in focus.
    color = mix(color, night + uTint * 0.6, uTintMix * 0.8);

    float vignette = smoothstep(1.3, 0.2, length(vUv - 0.5) * 1.7);
    color *= mix(0.5, 1.0, vignette);

    // Film grain, so large gradients never band.
    float grain = fract(sin(dot(vUv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.028;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** The point of light the bloom unfolds from. Additive, so it only ever brightens. */
export const coreVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const coreFragment = /* glsl */ `
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float glow = exp(-d * d * 6.0) + exp(-d * 18.0) * 1.4;
    vec3 color = mix(vec3(1.0, 0.45, 0.55), vec3(1.0, 0.85, 0.55), exp(-d * 8.0));
    gl_FragColor = vec4(color * glow * uIntensity, 1.0);
  }
`;
