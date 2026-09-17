import * as THREE from "three";

/**
 * One whole picture: softly rounded corners, never cropped more than its frame
 * needs, fading in as it arrives and into the dark with distance.
 */

export interface SharedUniforms {
  uTime: { value: number };
  /** 0..1: how far everything else steps back while a picture is open. */
  uDim: { value: number };
  /** Distance where the fog starts and where it is complete. */
  uFog: { value: THREE.Vector2 };
  uBg: { value: THREE.Color };
  /** 0..1: the whole room fades out and in between searches. */
  uGlobal: { value: number };
}

export type PictureUniforms = {
  map: { value: THREE.Texture | null };
  uHasMap: { value: number };
  uLoadedAt: { value: number };
  uColor: { value: THREE.Color };
  uSize: { value: THREE.Vector2 };
  uImageAspect: { value: number };
  uHover: { value: number };
  uFade: { value: number };
} & SharedUniforms;

const vertexShader = /* glsl */ `
  uniform float uHover;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    vec3 p = position;
    p.xy *= 1.0 + 0.04 * uHover;
    p.z += 0.12 * uHover;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float uHasMap;
  uniform float uLoadedAt;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec2 uSize;
  uniform float uImageAspect;
  uniform float uHover;
  uniform float uFade;
  uniform float uDim;
  uniform vec2 uFog;
  uniform vec3 uBg;
  uniform float uGlobal;

  varying vec2 vUv;
  varying float vDepth;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float radius = min(uSize.x, uSize.y) * 0.03;
    float sd = sdRoundBox(p, uSize * 0.5, radius);
    float aa = fwidth(sd) * 0.8;
    float mask = smoothstep(aa, -aa, sd);
    if (mask <= 0.001) discard;

    // Cover the frame: only differs from the whole picture when a frame's
    // shape was capped (very wide banners, very tall posters).
    vec2 uv = vUv - 0.5;
    float frameAspect = uSize.x / uSize.y;
    if (frameAspect > uImageAspect) uv.y *= uImageAspect / frameAspect;
    else uv.x *= frameAspect / uImageAspect;
    uv += 0.5;

    vec3 picture = uHasMap > 0.5 ? texture2D(map, uv).rgb : uColor;
    float loaded = uHasMap * clamp((uTime - uLoadedAt) / 0.6, 0.0, 1.0);
    float sheen = smoothstep(0.12, 0.0, abs(fract(vUv.x * 0.7 + vUv.y * 0.3 - uTime * 0.35) - 0.5));
    vec3 waiting = mix(uBg, uColor, 0.4) + sheen * 0.025;
    vec3 color = mix(waiting, picture, loaded);

    color *= 1.0 + 0.1 * uHover;
    color += vec3(1.0) * smoothstep(-0.03, 0.0, sd) * (0.05 + 0.25 * uHover);

    color = mix(color, uBg, uDim * 0.82);
    color = mix(color, uBg, smoothstep(uFog.x, uFog.y, vDepth));

    gl_FragColor = vec4(color, mask * uFade * uGlobal);
  }
`;

export function createShared(background: THREE.Color): SharedUniforms {
  return {
    uTime: { value: 0 },
    uDim: { value: 0 },
    uFog: { value: new THREE.Vector2(10, 40) },
    uBg: { value: background },
    uGlobal: { value: 1 },
  };
}

export function createPictureMaterial(shared: SharedUniforms, color: THREE.Color, width: number, height: number, imageAspect: number) {
  const uniforms: PictureUniforms = {
    // Shared entries are the same objects, so one change reaches every picture.
    ...shared,
    map: { value: null },
    uHasMap: { value: 0 },
    uLoadedAt: { value: 0 },
    uColor: { value: color },
    uSize: { value: new THREE.Vector2(width, height) },
    uImageAspect: { value: imageAspect },
    uHover: { value: 0 },
    uFade: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  return { material, uniforms };
}
