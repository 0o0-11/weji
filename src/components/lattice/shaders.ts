/**
 * GLSL for the WEJI star lattice.
 *
 * The lattice is the classic star-and-cross tiling: eight-point stars at every
 * point of a square grid, touching tip to tip, with the pointed crosses between
 * them. Stars carry pictures; crosses are coloured glass. Both are masked from
 * plain squares with signed distance functions, so one mesh draws them all.
 */

/** Shapes and colours shared by every shader. */
const COMMON = /* glsl */ `
  // Eight-point star of tip radius R: a diamond and a square laid over each other.
  float sdStar(vec2 p, float R) {
    p = abs(p);
    float diamond = (p.x + p.y - R) * 0.70710678;
    float square = max(p.x, p.y) - R * 0.70710678;
    return min(diamond, square);
  }

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c);
  }

  // WEJI's light: saffron, rose, violet, teal — and round again.
  vec3 wejiPalette(float t) {
    t = fract(t) * 4.0;
    vec3 saffron = vec3(1.0, 0.70, 0.25);
    vec3 rose = vec3(1.0, 0.31, 0.55);
    vec3 violet = vec3(0.55, 0.42, 1.0);
    vec3 teal = vec3(0.24, 0.88, 0.82);
    if (t < 1.0) return mix(saffron, rose, smoothstep(0.0, 1.0, t));
    if (t < 2.0) return mix(rose, violet, smoothstep(1.0, 2.0, t));
    if (t < 3.0) return mix(violet, teal, smoothstep(2.0, 3.0, t));
    return mix(teal, saffron, smoothstep(3.0, 4.0, t));
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
`;

/** Samples one square picture out of a texture atlas. Image rows are stored top-down. */
const ATLAS = /* glsl */ `
  uniform float uPerRow;
  uniform float uSlotPx;

  vec3 atlasSample(sampler2D atlas, float slot, vec2 uv) {
    float col = mod(slot, uPerRow);
    float row = floor(slot / uPerRow);
    float inset = 1.5 / uSlotPx;
    vec2 local = vec2(uv.x, 1.0 - uv.y) * (1.0 - 2.0 * inset) + inset;
    return texture2D(atlas, (vec2(col, row) + local) / uPerRow).rgb;
  }
`;

export const latticeVertex = /* glsl */ `
  attribute vec3 aCell;     // column, row, kind (0 star, 1 cross)
  attribute vec2 aSlot;     // picture slot in the front atlas and the back atlas
  attribute vec2 aLoaded;   // when each slot's picture arrived (-1 = not yet)
  attribute vec3 aColorA;
  attribute vec3 aColorB;
  attribute float aRand;

  uniform float uTime;
  uniform float uRot;
  uniform float uRadius;
  uniform float uCell;
  uniform float uRows;
  uniform float uCols;
  uniform float uVel;
  uniform float uGrow;
  uniform vec2 uOrigin;
  uniform float uFlip;
  uniform vec2 uFlipOrigin;
  uniform float uFall;
  uniform vec2 uOpenCell;
  uniform vec3 uLens;
  uniform vec3 uHoverA;
  uniform vec3 uHoverB;
  uniform float uMotion;

  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vKind;
  varying float vSlot;
  varying float vSide;
  varying float vLoaded;
  varying vec3 vColor;
  varying float vReveal;
  varying float vHover;
  varying float vFade;
  varying float vTheta;
  varying float vRand;
  varying float vFlipGlow;

  float wrapCols(float d) {
    return mod(d + uCols * 0.5, uCols) - uCols * 0.5;
  }

  float cellDistance(vec2 a, vec2 b) {
    return length(vec2(wrapCols(a.x - b.x), a.y - b.y));
  }

  float isCell(vec3 hover) {
    return hover.z * (1.0 - step(0.01, cellDistance(aCell.xy, hover.xy)));
  }

  void main() {
    vUv = uv;
    vLocal = position.xy;
    vKind = aCell.z;
    vRand = aRand;
    float star = 1.0 - aCell.z;

    // ── Entrance: cells light up in rings spreading from the first star.
    float growDist = cellDistance(aCell.xy, uOrigin);
    vReveal = clamp((uGrow - growDist) / 1.6, 0.0, 1.0);

    // ── Search: a wave turns every cell over to its new picture.
    float flipDist = cellDistance(aCell.xy, uFlipOrigin);
    float flip = smoothstep(0.0, 1.0, clamp((uFlip - flipDist) / 2.2, 0.0, 1.0));
    float flipAngle = flip * 3.14159265;
    vSide = step(0.5, flip);
    vFlipGlow = sin(flipAngle);

    vSlot = mix(aSlot.x, aSlot.y, vSide);
    float loadedAt = mix(aLoaded.x, aLoaded.y, vSide);
    vLoaded = loadedAt < 0.0 ? 0.0 : clamp((uTime - loadedAt) / 0.7, 0.0, 1.0);
    vColor = mix(aColorA, aColorB, vSide);

    // ── Hover: the star under the pointer lifts and opens into a square.
    vHover = star * (isCell(uHoverA) + isCell(uHoverB));

    // ── Opening a picture: everything else falls away.
    float openDist = cellDistance(aCell.xy, uOpenCell);
    float delay = aRand * 0.35 + min(openDist, 12.0) * 0.03;
    float fall = clamp((uFall * 1.45 - delay) / 0.85, 0.0, 1.0);
    fall = fall * fall;
    float opened = star * (1.0 - step(0.01, openDist)) * step(0.001, uFall);
    vFade = (1.0 - fall) * (1.0 - opened);

    // Local plane position, in cell units.
    vec2 local = position.xy * (1.0 + 0.2 * vHover) * mix(0.55, 1.0, smoothstep(0.0, 1.0, vReveal));
    float lx = local.x * cos(flipAngle);
    float lz = local.x * sin(flipAngle);

    float tumble = fall * (1.4 + aRand * 1.6);
    float ly = local.y * cos(tumble);
    lz += local.y * sin(tumble);

    // Where on the ring this vertex sits.
    float col = aCell.x + lx;
    float rowUp = (uRows - 1.0) * 0.5 - aCell.y + ly;
    float theta = col / uCols * 6.28318530 + uRot;
    float rel = atan(sin(theta), cos(theta));   // 0 = straight ahead
    vTheta = rel;

    // Pointer lens: a soft dome of cells rises toward the viewer.
    float lensD = length(vec2(wrapCols(col - uLens.x), (uRows - 1.0) * 0.5 - rowUp - uLens.y));
    float lens = uLens.z * exp(-lensD * lensD / 2.4) * 0.55;

    float breathe = sin(uTime * 0.7 + aCell.x * 0.45 + aCell.y * 0.8) * 0.04 * uMotion;
    float inward = lens + 0.55 * vHover + 0.5 * vFlipGlow + lz + breathe;
    inward -= (1.0 - vReveal) * 2.5;                      // entering cells rise from behind the wall
    inward -= fall * 7.0;                                  // falling cells drop away into the dark
    inward += abs(uVel) * 0.9 * (0.5 + 0.5 * cos(rel));   // fast turns pull the wall toward you

    float r = uRadius - inward * uCell;
    float y = rowUp * uCell;
    y += uVel * sin(rel) * 1.1 * uCell;                   // and shear the band like a ribbon
    y -= fall * fall * 6.0 * uCell;

    vec3 world = vec3(sin(theta) * r, y, -cos(theta) * r);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

export const latticeFragment = /* glsl */ `
  uniform sampler2D uAtlasA;
  uniform sampler2D uAtlasB;
  uniform float uTime;
  uniform vec3 uTint;

  varying vec2 vUv;
  varying vec2 vLocal;
  varying float vKind;
  varying float vSlot;
  varying float vSide;
  varying float vLoaded;
  varying vec3 vColor;
  varying float vReveal;
  varying float vHover;
  varying float vFade;
  varying float vTheta;
  varying float vRand;
  varying float vFlipGlow;

  ${COMMON}
  ${ATLAS}

  const float GROUT = 0.022;

  void main() {
    if (vFade <= 0.001 || vReveal <= 0.0) discard;
    vec2 p = vLocal;

    float sd;
    if (vKind < 0.5) {
      sd = mix(sdStar(p, 0.5), sdRoundBox(p, vec2(0.5), 0.08), vHover);
    } else {
      // A cross is whatever the four stars around it leave uncovered.
      float nearest = min(
        min(sdStar(p - vec2(0.5, 0.5), 0.5), sdStar(p - vec2(-0.5, 0.5), 0.5)),
        min(sdStar(p - vec2(0.5, -0.5), 0.5), sdStar(p - vec2(-0.5, -0.5), 0.5))
      );
      sd = -nearest;
    }
    sd += GROUT;
    float aa = fwidth(sd) * 0.9;
    float mask = smoothstep(aa, -aa, sd);
    if (mask <= 0.001) discard;

    // Entrance: the outline draws itself around the shape, then fills with light.
    float around = atan(p.y, p.x) / 6.28318530 + 0.5;
    float drawn = step(around, smoothstep(0.0, 0.5, vReveal) * 1.001);
    float fill = smoothstep(0.35, 1.0, vReveal);
    float edge = smoothstep(-0.06, -0.004, sd);

    vec3 irid = wejiPalette(vTheta * 0.16 + vRand * 0.35 + uTime * 0.035);
    vec3 color;

    if (vKind < 0.5) {
      vec2 uv = vSide > 0.5 ? vec2(1.0 - vUv.x, vUv.y) : vUv;
      vec3 picture = vSide > 0.5 ? atlasSample(uAtlasB, vSlot, uv) : atlasSample(uAtlasA, vSlot, uv);

      // Until its picture arrives, a star holds the picture's own colour and a sheen.
      float sheen = smoothstep(0.1, 0.0, abs(fract(p.x * 0.6 + p.y * 0.4 - uTime * 0.45 + vRand) - 0.5));
      vec3 waiting = mix(vec3(0.04, 0.035, 0.07), vColor, 0.3) + irid * 0.06 + sheen * 0.05;
      color = mix(waiting, picture, vLoaded);
      color = mix(color, color * (0.92 + uTint * 0.16), 0.5);
      color *= 1.0 - edge * 0.25;
      color += irid * edge * (0.28 + 0.9 * vHover) ;
      color += irid * vFlipGlow * 0.35 * edge;
    } else {
      float streak = smoothstep(0.09, 0.0, abs(fract(vTheta * 0.35 + p.x * 0.25 + p.y * 0.35 - uTime * 0.06) - 0.5));
      vec3 glass = mix(vec3(0.045, 0.04, 0.085), uTint * 0.55, 0.3);
      color = glass + irid * (0.16 + 0.5 * edge) + streak * irid * 0.35;
    }

    vec3 line = irid * 1.6 * drawn * smoothstep(-0.045, -0.01, sd);
    color = mix(line, color, fill) + line * (1.0 - fill) * 0.5;
    color *= vFade;

    gl_FragColor = vec4(color, mask);
  }
`;

/** Full-screen backdrop: deep ink with slow pools of WEJI light, tinted by the pictures in view. */
export const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const backdropFragment = /* glsl */ `
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uRot;
  uniform vec3 uTint;
  uniform float uFade;
  varying vec2 vUv;

  ${COMMON}

  void main() {
    vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
    vec2 q = vUv * aspect;
    vec3 color = vec3(0.027, 0.024, 0.051);

    float t = uTime * 0.05;
    vec2 a = vec2(0.18 + 0.06 * sin(t * 1.3), 0.86) * aspect;
    vec2 b = vec2(0.86 + 0.05 * cos(t), 0.14) * aspect;
    vec2 c = vec2(0.5 + 0.25 * sin(uRot * 0.5), 0.5) * aspect;
    color += vec3(1.0, 0.62, 0.22) * 0.13 * exp(-dot(q - a, q - a) * 2.2);
    color += vec3(0.55, 0.40, 1.0) * 0.16 * exp(-dot(q - b, q - b) * 2.0);
    color += uTint * 0.12 * exp(-dot(q - c, q - c) * 1.2);

    // A faint horizon of light under the ring.
    color += vec3(1.0, 0.36, 0.55) * 0.05 * exp(-pow((vUv.y - 0.1) * 9.0, 2.0));

    // Dust that drifts with the ring.
    vec2 grid = vec2(vUv.x * 90.0 + uRot * 14.0, vUv.y * 50.0);
    float spark = step(0.985, hash12(floor(grid))) * smoothstep(0.35, 0.0, length(fract(grid) - 0.5));
    color += spark * 0.35 * wejiPalette(hash12(floor(grid) + 3.0));

    gl_FragColor = vec4(color * uFade, 1.0);
  }
`;

/**
 * Post pass (strong devices only): the glass eight-point star that sweeps
 * across on every search, bending the lattice behind it like thick glass, plus
 * speed-linked colour split, vignette and grain.
 */
export const postFragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uVel;
  uniform float uSweep;
  uniform float uSweepSize;
  varying vec2 vUv;

  ${COMMON}

  float sweepStar(vec2 p, float angle) {
    return sdStar(rot2(angle) * p, uSweepSize) + 0.004;
  }

  void main() {
    vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
    vec2 uv = vUv;

    // Colour split grows with speed.
    vec2 fromCentre = uv - 0.5;
    float split = 0.0009 + min(abs(uVel), 1.0) * 0.006;
    vec3 base = vec3(
      texture2D(tScene, uv + fromCentre * split).r,
      texture2D(tScene, uv).g,
      texture2D(tScene, uv - fromCentre * split).b
    );
    vec3 color = base;

    if (uSweep > 0.0 && uSweep < 1.0) {
      float s = uSweep * uSweep * (3.0 - 2.0 * uSweep);
      vec2 centre = mix(vec2(-0.35, 1.25), vec2(1.35, -0.25), s);
      float angle = s * 2.2;
      vec2 p = (uv - centre) * aspect;
      float sd = sweepStar(p, angle);

      if (sd < 0.02) {
        float e = 0.0025;
        vec2 grad = vec2(
          sweepStar(p + vec2(e, 0.0), angle) - sweepStar(p - vec2(e, 0.0), angle),
          sweepStar(p + vec2(0.0, e), angle) - sweepStar(p - vec2(0.0, e), angle)
        ) / (2.0 * e);

        float bevel = 1.0 - smoothstep(0.0, 0.11, -sd);   // 1 at the rim, 0 in the flat middle
        vec2 bend = -grad * bevel * bevel * 0.045 + (centre - uv) * aspect * 0.06;
        bend /= aspect;

        vec3 glass = vec3(
          texture2D(tScene, uv + bend * 1.12).r,
          texture2D(tScene, uv + bend).g,
          texture2D(tScene, uv + bend * 0.88).b
        );
        glass = glass * 1.08 + wejiPalette(s + p.x * 0.4) * 0.07;

        vec3 normal = normalize(vec3(-grad * bevel * 1.6, 1.0));
        float spec = pow(max(dot(normal, normalize(vec3(-0.45, 0.6, 0.66))), 0.0), 36.0);
        glass += vec3(1.0, 0.95, 0.85) * spec * 0.9;

        float inside = smoothstep(0.003, -0.003, sd);
        float rim = smoothstep(0.006, 0.0, abs(sd));
        color = mix(color, glass, inside) + rim * wejiPalette(s * 2.0 + p.y) * 0.9;
      }
    }

    float vignette = smoothstep(1.3, 0.3, length(fromCentre * aspect));
    color *= mix(0.62, 1.0, vignette);
    color += (hash12(uv * uRes + fract(uTime) * 91.0) - 0.5) * 0.03;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * The opened picture. A star at the picture's place in the ring unfolds its
 * eight points like an aperture until it becomes the picture's own frame,
 * whose edges bulge slightly like a lens. Behind it, the room floods with the
 * picture's colours.
 */
export const photoFragment = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform sampler2D uAtlas;
  uniform float uSlot;
  uniform float uPhotoReady;
  uniform float uOpen;
  uniform vec2 uRes;
  uniform vec3 uStart;      // star centre (device px, y up) and tip radius
  uniform vec4 uRect;       // frame centre and half size (device px)
  uniform float uPhotoAspect;
  uniform float uTime;
  uniform float uPixel;
  varying vec2 vUv;

  ${COMMON}
  ${ATLAS}

  vec3 coverSample(vec2 uv, vec2 frameHalf, bool full) {
    // Fit the picture to cover the frame without stretching.
    float frameAspect = frameHalf.x / frameHalf.y;
    vec2 scale = frameAspect > uPhotoAspect
      ? vec2(1.0, uPhotoAspect / frameAspect)
      : vec2(frameAspect / uPhotoAspect, 1.0);
    vec2 photoUv = (uv - 0.5) * scale + 0.5;
    if (full) return texture2D(uPhoto, photoUv).rgb;
    // The atlas copy is a square centre crop.
    vec2 squareScale = uPhotoAspect > 1.0 ? vec2(1.0 / uPhotoAspect, 1.0) : vec2(1.0, uPhotoAspect);
    vec2 squareUv = (photoUv - 0.5) / squareScale + 0.5;
    return atlasSample(uAtlas, uSlot, clamp(squareUv, 0.0, 1.0));
  }

  void main() {
    float e = uOpen < 0.5 ? 4.0 * uOpen * uOpen * uOpen : 1.0 - pow(-2.0 * uOpen + 2.0, 3.0) / 2.0;
    vec2 px = gl_FragCoord.xy;

    vec2 centre = mix(uStart.xy, uRect.xy, e);
    vec2 frameHalf = mix(vec2(uStart.z * 0.72), uRect.zw, e);
    float tip = mix(uStart.z, length(uRect.zw) * 1.5, smoothstep(0.0, 0.9, e));
    vec2 p = px - centre;

    float twist = (1.0 - e) * 0.3927;
    float sd = max(sdStar(rot2(twist) * p, tip), sdRoundBox(p, frameHalf, mix(2.0, 16.0, e) * uPixel));
    float mask = smoothstep(1.0, -1.0, sd);

    // Room flood: a soft, dark, enlarged copy of the picture fills the screen.
    vec2 screenUv = gl_FragCoord.xy / uRes;
    vec2 screenHalf = uRes * 0.5;
    vec3 flood = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float a = float(i) * 1.2566;
      flood += coverSample(screenUv + vec2(cos(a), sin(a)) * 0.02, screenHalf, false);
    }
    flood = flood / 5.0;
    float vignette = smoothstep(1.2, 0.2, length((screenUv - 0.5) * vec2(uRes.x / uRes.y, 1.0)));
    float luma = dot(flood, vec3(0.299, 0.587, 0.114));
    flood = mix(vec3(luma), flood, 1.35);                 // a little richer, so the room takes the picture's colour
    flood = flood * (0.12 + 0.14 * vignette) + vec3(0.018, 0.015, 0.035);
    float floodAlpha = smoothstep(0.05, 0.75, e) * 0.97;

    // The picture itself, with lens-like edges.
    vec2 local = p / (frameHalf * 2.0) + 0.5;
    vec2 q = local * 2.0 - 1.0;
    float r2 = dot(q, q);
    vec2 bulged = q * (1.0 - 0.05 * r2 * e) * 0.5 + 0.5;
    vec2 fringe = (bulged - 0.5) * 0.006 * r2;
    vec3 thumb = coverSample(bulged, frameHalf, false);
    vec3 full = vec3(
      coverSample(bulged + fringe, frameHalf, true).r,
      coverSample(bulged, frameHalf, true).g,
      coverSample(bulged - fringe, frameHalf, true).b
    );
    vec3 photo = mix(thumb, full, uPhotoReady);

    vec3 irid = wejiPalette(atan(p.y, p.x) / 6.2831853 + uTime * 0.1);
    float rim = smoothstep(2.5 * uPixel, 0.0, abs(sd)) * (1.0 - smoothstep(0.75, 1.0, e));
    photo += irid * rim * 1.2;

    vec3 color = mix(flood, photo, mask);
    float alpha = max(mask, floodAlpha);
    gl_FragColor = vec4(color + irid * rim * (1.0 - mask), max(alpha, rim));
  }
`;

export const screenVertex = backdropVertex;
