import * as THREE from "three";
import type { Palette } from "./palettes";
import { aspectOf, RoomScene, seeded, type RoomOptions, type RoomPicture } from "./RoomScene";

/** Very wide banners and very tall posters get a calmer frame; the picture is cropped to fit it. */
const frameAspect = (picture: RoomPicture) => THREE.MathUtils.clamp(aspectOf(picture), 0.62, 1.9);

/** Where the winding tunnel's centre line is, a given distance along it. Shared with the dust shader. */
const PATH_X = { amplitude: 2.4, frequency: 0.045 };
const PATH_Y = { amplitude: 1.1, frequency: 0.07, phase: 1.3 };

const dustVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uTravel;
  uniform float uDepth;
  uniform float uPixel;
  varying float vAlpha;

  vec2 path(float d) {
    return vec2(sin(d * ${PATH_X.frequency}) * ${PATH_X.amplitude}, sin(d * ${PATH_Y.frequency} + ${PATH_Y.phase}) * ${PATH_Y.amplitude});
  }

  void main() {
    float ahead = mod(position.z - uTravel, uDepth);
    vec2 drift = vec2(sin(uTime * 0.3 + aSeed * 40.0), cos(uTime * 0.23 + aSeed * 17.0)) * 0.2;
    vec2 centre = path(uTravel + ahead) - path(uTravel);
    vec4 view = viewMatrix * vec4(position.xy + drift + centre, -ahead + 4.0, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uPixel * (0.05 + 0.1 * fract(aSeed * 13.7)) / max(1.0, -view.z);
    vAlpha = smoothstep(0.5, 5.0, ahead) * (1.0 - smoothstep(uDepth * 0.55, uDepth * 0.95, ahead)) * (0.3 + 0.7 * fract(aSeed * 7.3));
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGlobal;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * glow * glow * vAlpha * (0.4 + 0.6 * uGlobal), 1.0);
  }
`;

/**
 * The WEJI space tunnel: floating pictures wind round a slowly turning spiral
 * that forms a curving tunnel you fly through. Each picture half-faces the
 * traveller, so it reads clearly, and stays close to the path, so it stays
 * large. Soft dust drifts past to give the flight depth and speed.
 */
export class SpaceTunnelRoom extends RoomScene {
  private static readonly SPACING = 0.55;
  private static readonly AHEAD = 4;
  private static readonly DUST_DEPTH = 70;

  private depth = 1;
  private travel = 0;
  private spin = 0;
  private perRing = 6;
  private lastWarp = 0;
  private look = new THREE.Vector2();
  private dust: { points: THREE.Points; material: THREE.ShaderMaterial } | null = null;

  // Reused every frame, so flying never creates garbage.
  private readonly basis = new THREE.Matrix4();
  private readonly here = new THREE.Vector2();
  private readonly centre = new THREE.Vector2();
  private readonly normal = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly pictureUp = new THREE.Vector3();
  private static readonly UP = new THREE.Vector3(0, 1, 0);

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(12, 42);
    this.createDust(options.palette);
  }

  protected capacity() {
    return this.tier === "high" ? 150 : 90;
  }

  protected layout(pictures: RoomPicture[]) {
    const random = seeded(11);
    const portrait = this.camera.aspect < 0.9;
    this.perRing = portrait ? 5 : 6;
    this.depth = Math.max(40, pictures.length * SpaceTunnelRoom.SPACING);
    pictures.forEach((picture, index) => {
      const aspect = frameAspect(picture);
      const height = (portrait ? 1.7 : 2.1) * (0.9 + random() * 0.25);
      const width = height * aspect;
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.scale(width, height, 1);
      const item = this.addItem(index, picture, geometry, width, height);
      // A helix: each picture a step further round and a step further ahead.
      item.data.angle = (index * Math.PI * 2) / this.perRing + (random() - 0.5) * 0.25;
      item.data.radius = (portrait ? 2.4 : 3.8) + (random() - 0.5) * 0.8;
      item.data.distance = index * SpaceTunnelRoom.SPACING;
    });
  }

  protected loadOrder() {
    return [...this.items];
  }

  protected fitCamera(width: number, height: number) {
    this.camera.fov = width / height < 0.9 ? 76 : 62;
    if (this.dust) this.dust.material.uniforms.uPixel.value = this.renderer.getPixelRatio() * height * 0.5;
  }

  protected onPalette(palette: Palette) {
    this.dust?.material.uniforms.uColor.value.set(palette.accent);
  }

  private path(distance: number, target: THREE.Vector2) {
    return target.set(
      Math.sin(distance * PATH_X.frequency) * PATH_X.amplitude,
      Math.sin(distance * PATH_Y.frequency + PATH_Y.phase) * PATH_Y.amplitude,
    );
  }

  private createDust(palette: Palette) {
    const count = this.tier === "high" ? 520 : 240;
    const random = seeded(29);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 1 + random() * 6.5;
      positions[i * 3] = Math.cos(angle) * radius * 1.3;
      positions[i * 3 + 1] = Math.sin(angle) * radius * 0.9;
      positions[i * 3 + 2] = random() * SpaceTunnelRoom.DUST_DEPTH;
      seeds[i] = random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.shared.uTime,
        uGlobal: this.shared.uGlobal,
        uTravel: { value: 0 },
        uDepth: { value: SpaceTunnelRoom.DUST_DEPTH },
        uPixel: { value: this.renderer.getPixelRatio() * this.host.clientHeight * 0.5 },
        uColor: { value: new THREE.Color(palette.accent) },
      },
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.dust = { points, material };
  }

  protected update(dt: number, frozen: boolean) {
    const portrait = this.camera.aspect < 0.9;
    const warpStep = this.warp - this.lastWarp;
    this.lastWarp = this.warp;

    if (!frozen) {
      const step = this.scrollDelta * this.depth + (this.dragY - this.dragX) * 0.01;
      this.travel += step;
      if (!this.reducedMotion && this.idleFor > 2.5) this.travel += dt * 0.4 * Math.min(1, (this.idleFor - 2.5) / 2);
      // The spiral turns slowly on its own, and a little faster as you fly.
      if (!this.reducedMotion) this.spin += dt * 0.04 + (step + Math.max(0, warpStep)) * 0.012;

      const perSecond = dt > 0 ? (Math.abs(step) + Math.abs(warpStep)) / dt : 0;
      this.speed += (Math.min(1, perSecond / 40) - this.speed) * (1 - Math.exp(-dt * 5));

      // Look along the bend ahead, and a little toward the pointer.
      const flown = this.travel + this.warp;
      this.path(flown, this.here);
      this.path(flown + 12, this.centre).sub(this.here);
      const lean = this.reducedMotion || !this.pointerInside ? 0 : 1;
      this.look.x += (this.pointerNdc.x * lean - this.look.x) * (1 - Math.exp(-dt * 2.5));
      this.look.y += (this.pointerNdc.y * lean - this.look.y) * (1 - Math.exp(-dt * 2.5));
      this.camera.rotation.set(
        Math.atan2(this.centre.y, 12) * 0.6 + this.look.y * 0.08,
        -Math.atan2(this.centre.x, 12) * 0.6 - this.look.x * 0.12,
        0,
      );
      const fov = (portrait ? 76 : 62) + (this.reducedMotion ? 0 : this.speed * 14);
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

    const flown = this.travel + this.warp;
    if (this.dust) this.dust.material.uniforms.uTravel.value = flown;
    this.path(flown, this.here);

    for (const item of this.items) {
      const ahead = THREE.MathUtils.euclideanModulo(item.data.distance - flown + SpaceTunnelRoom.AHEAD, this.depth);
      this.path(flown + ahead, this.centre).sub(this.here);
      const angle = item.data.angle + this.spin;
      const x = Math.cos(angle) * item.data.radius * (portrait ? 0.8 : 1.3);
      const y = Math.sin(angle) * item.data.radius * (portrait ? 1.25 : 0.85);
      item.mesh.position.set(this.centre.x + x, this.centre.y + y, -ahead + SpaceTunnelRoom.AHEAD);

      // Half toward the tunnel's centre, half toward the traveller; always upright.
      this.normal.set(-x, -y, 0).normalize().multiplyScalar(0.42);
      this.normal.z += 0.58;
      this.normal.normalize();
      this.right.crossVectors(SpaceTunnelRoom.UP, this.normal).normalize();
      this.pictureUp.crossVectors(this.normal, this.right);
      item.mesh.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.right, this.pictureUp, this.normal));

      const fade = THREE.MathUtils.smoothstep(ahead, 1.5, 5) * (1 - THREE.MathUtils.smoothstep(ahead, this.depth - 6, this.depth - 1));
      if (!item.data.hidden) item.uniforms.uFade.value = fade;
    }
  }

  dispose() {
    if (this.dust) {
      this.dust.points.geometry.dispose();
      this.dust.material.dispose();
    }
    super.dispose();
  }
}
