import * as THREE from "three";
import type { Palette } from "./theme";
import { aspectOf, RoomScene, seeded, type RoomOptions, type RoomPicture } from "./RoomScene";

/** Very wide banners and very tall posters get a calmer frame; the picture is cropped to fit it. */
const frameAspect = (picture: RoomPicture) => THREE.MathUtils.clamp(aspectOf(picture), 0.62, 1.9);

const dustVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uTravel;
  uniform float uDepth;
  uniform float uPixel;
  varying float vAlpha;

  void main() {
    float ahead = mod(position.z - uTravel, uDepth);
    vec2 drift = vec2(sin(uTime * 0.3 + aSeed * 40.0), cos(uTime * 0.23 + aSeed * 17.0)) * 0.15;
    vec4 view = viewMatrix * vec4(position.xy + drift, -ahead + 3.0, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uPixel * (0.04 + 0.08 * fract(aSeed * 13.7)) / max(1.0, -view.z);
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

interface Lane {
  /** Where on the wall this lane runs, and which way its pictures face. */
  offset: THREE.Vector3;
  normal: THREE.Vector3;
  up: THREE.Vector3;
  /** true for side walls: the picture's width runs along the corridor. */
  side: boolean;
  across: number;
  length: number;
}

/**
 * The WEJI tunnel: pictures line the walls, floor and ceiling of a long
 * corridor that glows at its far end, and scrolling moves you through it.
 * Soft specks of light drift past to give the journey depth and speed.
 */
export class TunnelRoom extends RoomScene {
  private static readonly GAP = 0.35;
  private static readonly AHEAD = 3;
  private static readonly DUST_DEPTH = 60;

  private lanes: Lane[] = [];
  private travel = 0;
  private lastWarp = 0;
  private look = new THREE.Vector2();
  private dust: { points: THREE.Points; material: THREE.ShaderMaterial } | null = null;

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(12, 48);
    this.createDust(options.palette);
  }

  protected capacity() {
    return this.tier === "high" ? 150 : 90;
  }

  private get portrait() {
    return this.camera.aspect < 0.9;
  }

  private get halfWidth() {
    return this.portrait ? 2.2 : 3.6;
  }

  private get halfHeight() {
    return this.portrait ? 3.0 : 2.4;
  }

  protected layout(pictures: RoomPicture[]) {
    const halfWidth = this.halfWidth;
    const halfHeight = this.halfHeight;
    const gap = TunnelRoom.GAP;
    const up = new THREE.Vector3(0, 1, 0);
    // On the floor a picture's top points away from you; on the ceiling, toward you,
    // so both read the right way up while looking ahead.
    const far = new THREE.Vector3(0, 0, -1);
    const near = new THREE.Vector3(0, 0, 1);

    // Two rows on each side wall, two lanes on the floor and on the ceiling.
    const sideSize = halfHeight - gap;
    const flatSize = halfWidth - gap;
    this.lanes = [
      { offset: new THREE.Vector3(-halfWidth, halfHeight / 2, 0), normal: new THREE.Vector3(1, 0, 0), up, side: true, across: sideSize, length: 0 },
      { offset: new THREE.Vector3(-halfWidth, -halfHeight / 2, 0), normal: new THREE.Vector3(1, 0, 0), up, side: true, across: sideSize, length: 0 },
      { offset: new THREE.Vector3(halfWidth, halfHeight / 2, 0), normal: new THREE.Vector3(-1, 0, 0), up, side: true, across: sideSize, length: 0 },
      { offset: new THREE.Vector3(halfWidth, -halfHeight / 2, 0), normal: new THREE.Vector3(-1, 0, 0), up, side: true, across: sideSize, length: 0 },
      { offset: new THREE.Vector3(-halfWidth / 2, -halfHeight, 0), normal: new THREE.Vector3(0, 1, 0), up: far, side: false, across: flatSize, length: 0 },
      { offset: new THREE.Vector3(halfWidth / 2, -halfHeight, 0), normal: new THREE.Vector3(0, 1, 0), up: far, side: false, across: flatSize, length: 0 },
      { offset: new THREE.Vector3(-halfWidth / 2, halfHeight, 0), normal: new THREE.Vector3(0, -1, 0), up: near, side: false, across: flatSize, length: 0 },
      { offset: new THREE.Vector3(halfWidth / 2, halfHeight, 0), normal: new THREE.Vector3(0, -1, 0), up: near, side: false, across: flatSize, length: 0 },
    ];

    pictures.forEach((picture, index) => {
      const lane = this.lanes[index % this.lanes.length];
      const aspect = frameAspect(picture);
      const width = lane.side ? lane.across * aspect : lane.across;
      const height = lane.side ? lane.across : lane.across / aspect;
      const alongLength = lane.side ? width : height;

      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.scale(width, height, 1);
      const item = this.addItem(index, picture, geometry, width, height);
      item.data.lane = index % this.lanes.length;
      item.data.along = lane.length + alongLength / 2;
      lane.length += alongLength + gap;

      const right = new THREE.Vector3().crossVectors(lane.up, lane.normal);
      item.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, lane.up, lane.normal));
    });
    for (const lane of this.lanes) lane.length = Math.max(lane.length, 30);
  }

  protected loadOrder() {
    return [...this.items].sort((a, b) => a.data.along - b.data.along);
  }

  protected fitCamera(width: number, height: number) {
    this.camera.fov = width / height < 0.9 ? 78 : 64;
    if (this.dust) this.dust.material.uniforms.uPixel.value = this.renderer.getPixelRatio() * height * 0.5;
  }

  protected onPalette(palette: Palette) {
    this.dust?.material.uniforms.uColor.value.set(palette.accent);
  }

  private createDust(palette: Palette) {
    const count = this.tier === "high" ? 420 : 200;
    const random = seeded(29);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const halfWidth = this.portrait ? 2.2 : 3.6;
    const halfHeight = this.portrait ? 3.0 : 2.4;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() * 2 - 1) * (halfWidth - 0.3);
      positions[i * 3 + 1] = (random() * 2 - 1) * (halfHeight - 0.3);
      positions[i * 3 + 2] = random() * TunnelRoom.DUST_DEPTH;
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
        uDepth: { value: TunnelRoom.DUST_DEPTH },
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
    const warpStep = this.warp - this.lastWarp;
    this.lastWarp = this.warp;

    if (!frozen) {
      const step = this.scrollDelta * 90 + (this.dragY - this.dragX) * 0.012;
      this.travel += step;
      if (!this.reducedMotion && this.idleFor > 2.5) this.travel += dt * 0.5 * Math.min(1, (this.idleFor - 2.5) / 2);

      const perSecond = dt > 0 ? (Math.abs(step) + Math.abs(warpStep)) / dt : 0;
      this.speed += (Math.min(1, perSecond / 40) - this.speed) * (1 - Math.exp(-dt * 5));

      // Look toward the pointer, to take in the walls as they pass.
      const lean = this.reducedMotion || !this.pointerInside ? 0 : 1;
      const ease = 1 - Math.exp(-dt * 2.5);
      this.look.x += (this.pointerNdc.x * lean - this.look.x) * ease;
      this.look.y += (this.pointerNdc.y * lean - this.look.y) * ease;
      this.camera.rotation.set(this.look.y * 0.22, -this.look.x * 0.32, 0);

      const fov = (this.portrait ? 78 : 64) + (this.reducedMotion ? 0 : this.speed * 12);
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

    const flown = this.travel + this.warp;
    if (this.dust) this.dust.material.uniforms.uTravel.value = flown;
    for (const item of this.items) {
      const lane = this.lanes[item.data.lane];
      const distance = THREE.MathUtils.euclideanModulo(item.data.along - flown + TunnelRoom.AHEAD, lane.length);
      item.mesh.position.set(lane.offset.x, lane.offset.y, -distance + TunnelRoom.AHEAD);
      const fade = THREE.MathUtils.smoothstep(distance, 0.5, 3.5) * (1 - THREE.MathUtils.smoothstep(distance, lane.length - 4, lane.length - 0.5));
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
