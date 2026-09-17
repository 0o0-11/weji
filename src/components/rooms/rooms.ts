import * as THREE from "three";
import { aspectOf, RoomScene, seeded, type RoomOptions, type RoomPicture } from "./RoomScene";

/** Very wide banners and very tall posters get a calmer frame; the picture is cropped to fit it. */
const frameAspect = (picture: RoomPicture) => THREE.MathUtils.clamp(aspectOf(picture), 0.62, 1.9);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Floating in space: whole pictures hang at different depths, and scrolling
//    flies you forward between them.
// ─────────────────────────────────────────────────────────────────────────────

export class SpaceRoom extends RoomScene {
  private static readonly SPACING = 0.9;
  private static readonly AHEAD = 7;
  private depth = 1;
  private travel = 0;
  private look = new THREE.Vector2();

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(10, 30);
  }

  protected capacity() {
    return this.tier === "high" ? 140 : 80;
  }

  protected layout(pictures: RoomPicture[]) {
    const random = seeded(7);
    const portrait = this.camera.aspect < 0.9;
    this.depth = Math.max(40, pictures.length * SpaceRoom.SPACING);
    pictures.forEach((picture, index) => {
      const aspect = frameAspect(picture);
      const height = (portrait ? 2.0 : 2.7) * (0.85 + random() * 0.35);
      const width = height * aspect;
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.scale(width, height, 1);
      const item = this.addItem(index, picture, geometry, width, height);

      // Spread around the flight path, leaving a clear lane through the middle.
      const angle = index * 2.39996 + random() * 0.5;
      const radius = 1.8 + Math.sqrt(random()) * 3.0;
      item.data.x = Math.cos(angle) * radius * (portrait ? 0.62 : 1.35);
      item.data.y = Math.sin(angle) * radius * (portrait ? 1.0 : 0.72);
      item.data.distance = index * SpaceRoom.SPACING;
      item.mesh.rotation.y = -item.data.x * 0.05 + (random() - 0.5) * 0.2;
      item.mesh.rotation.z = (random() - 0.5) * 0.06;
    });
  }

  protected loadOrder() {
    return [...this.items];
  }

  protected fitCamera() {
    this.camera.fov = this.camera.aspect < 0.9 ? 70 : 58;
  }

  protected update(dt: number, frozen: boolean) {
    if (!frozen) {
      this.travel += this.scrollDelta * this.depth + (this.dragY - this.dragX) * 0.01;
      if (!this.reducedMotion && this.idleFor > 2.5) this.travel += dt * 0.35 * Math.min(1, (this.idleFor - 2.5) / 2);
      const perSecond = dt > 0 ? (this.scrollDelta * this.depth) / dt : 0;
      this.speed += (Math.min(1, Math.abs(perSecond) / 40) - this.speed) * (1 - Math.exp(-dt * 5));

      // The view leans gently toward the pointer.
      const lean = this.reducedMotion ? 0 : 1;
      this.look.lerp(this.pointerNdc.clone().multiplyScalar(lean), 1 - Math.exp(-dt * 2.5));
      this.camera.rotation.set(this.look.y * 0.07, -this.look.x * 0.1, 0);
      this.camera.position.set(this.look.x * 0.4, this.look.y * 0.3, 0);
      const fov = (this.camera.aspect < 0.9 ? 70 : 58) + this.speed * 8;
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

    for (const item of this.items) {
      const distance = THREE.MathUtils.euclideanModulo(item.data.distance - this.travel + SpaceRoom.AHEAD, this.depth);
      item.mesh.position.set(item.data.x, item.data.y, -distance + 2);
      // Fade in far away, and out just before passing the viewer.
      const fade = THREE.MathUtils.smoothstep(distance, 3.5, 7) * (1 - THREE.MathUtils.smoothstep(distance, this.depth - 6, this.depth - 1));
      if (!item.data.hidden) item.uniforms.uFade.value = fade;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tunnel: pictures line the walls, floor and ceiling of a long corridor,
//    and scrolling moves you through it.
// ─────────────────────────────────────────────────────────────────────────────

interface Lane {
  /** Where on the wall this lane runs, and which way pictures face. */
  offset: THREE.Vector3;
  normal: THREE.Vector3;
  up: THREE.Vector3;
  /** true for side walls: the picture's width runs along the corridor. */
  side: boolean;
  across: number;
  length: number;
}

export class TunnelRoom extends RoomScene {
  private static readonly GAP = 0.35;
  private static readonly AHEAD = 3;
  private lanes: Lane[] = [];
  private travel = 0;
  private look = new THREE.Vector2();

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(12, 48);
  }

  protected capacity() {
    return this.tier === "high" ? 150 : 90;
  }

  protected layout(pictures: RoomPicture[]) {
    const portrait = this.camera.aspect < 0.9;
    const halfWidth = portrait ? 2.2 : 3.6;
    const halfHeight = portrait ? 3.0 : 2.4;
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
  }

  protected update(dt: number, frozen: boolean) {
    if (!frozen) {
      this.travel += this.scrollDelta * 90 + (this.dragY - this.dragX) * 0.012;
      if (!this.reducedMotion && this.idleFor > 2.5) this.travel += dt * 0.5 * Math.min(1, (this.idleFor - 2.5) / 2);

      // Look toward the pointer, to take in the walls as they pass.
      const target = this.reducedMotion || !this.pointerInside ? new THREE.Vector2() : this.pointerNdc;
      this.look.lerp(target, 1 - Math.exp(-dt * 2.5));
      this.camera.rotation.set(this.look.y * 0.22, -this.look.x * 0.32, 0);
    }

    for (const item of this.items) {
      const lane = this.lanes[item.data.lane];
      const distance = THREE.MathUtils.euclideanModulo(item.data.along - this.travel + TunnelRoom.AHEAD, lane.length);
      item.mesh.position.set(lane.offset.x, lane.offset.y, -distance + TunnelRoom.AHEAD);
      const fade = THREE.MathUtils.smoothstep(distance, 0.5, 3.5) * (1 - THREE.MathUtils.smoothstep(distance, lane.length - 4, lane.length - 0.5));
      if (!item.data.hidden) item.uniforms.uFade.value = fade;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Space tunnel: the two favourites together. Floating pictures wind round a
//    slowly turning spiral that forms a curving tunnel you fly through. Each
//    picture half-faces the traveller, so it reads clearly, and they stay
//    close to the path, so they stay large.
// ─────────────────────────────────────────────────────────────────────────────

export class SpaceTunnelRoom extends RoomScene {
  private static readonly SPACING = 0.55;
  private static readonly AHEAD = 4;
  private depth = 1;
  private travel = 0;
  private spin = 0;
  private perRing = 7;
  private look = new THREE.Vector2();
  private readonly basis = new THREE.Matrix4();

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(12, 42);
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
  }

  /** Where the winding tunnel's centre line is, a given distance along it. */
  private path(distance: number) {
    return new THREE.Vector2(Math.sin(distance * 0.045) * 2.4, Math.sin(distance * 0.07 + 1.3) * 1.1);
  }

  protected update(dt: number, frozen: boolean) {
    const portrait = this.camera.aspect < 0.9;
    if (!frozen) {
      const step = this.scrollDelta * this.depth + (this.dragY - this.dragX) * 0.01;
      this.travel += step;
      if (!this.reducedMotion && this.idleFor > 2.5) this.travel += dt * 0.4 * Math.min(1, (this.idleFor - 2.5) / 2);
      // The spiral turns slowly on its own, and a little faster as you fly.
      if (!this.reducedMotion) this.spin += dt * 0.04 + step * 0.012;

      const perSecond = dt > 0 ? Math.abs(step) / dt : 0;
      this.speed += (Math.min(1, perSecond / 40) - this.speed) * (1 - Math.exp(-dt * 5));

      // Look along the bend ahead, and a little toward the pointer.
      const here = this.path(this.travel);
      const ahead = this.path(this.travel + 12).sub(here);
      const lean = this.reducedMotion || !this.pointerInside ? new THREE.Vector2() : this.pointerNdc;
      this.look.lerp(lean, 1 - Math.exp(-dt * 2.5));
      this.camera.rotation.set(Math.atan2(ahead.y, 12) * 0.6 + this.look.y * 0.08, -Math.atan2(ahead.x, 12) * 0.6 - this.look.x * 0.12, 0);
      const fov = (portrait ? 76 : 62) + (this.reducedMotion ? 0 : this.speed * 10);
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

    const here = this.path(this.travel);
    const toViewer = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3(0, 1, 0);
    for (const item of this.items) {
      const ahead = THREE.MathUtils.euclideanModulo(item.data.distance - this.travel + SpaceTunnelRoom.AHEAD, this.depth);
      const centre = this.path(this.travel + ahead).sub(here);
      const angle = item.data.angle + this.spin;
      const x = Math.cos(angle) * item.data.radius * (portrait ? 0.8 : 1.3);
      const y = Math.sin(angle) * item.data.radius * (portrait ? 1.25 : 0.85);
      item.mesh.position.set(centre.x + x, centre.y + y, -ahead + SpaceTunnelRoom.AHEAD);

      // Half toward the tunnel's centre, half toward the traveller; always upright.
      const normal = new THREE.Vector3(-x, -y, 0).normalize().multiplyScalar(0.42).addScaledVector(toViewer, 0.58).normalize();
      const right = new THREE.Vector3().crossVectors(up, normal).normalize();
      const pictureUp = new THREE.Vector3().crossVectors(normal, right);
      item.mesh.quaternion.setFromRotationMatrix(this.basis.makeBasis(right, pictureUp, normal));

      const fade = THREE.MathUtils.smoothstep(ahead, 1.5, 5) * (1 - THREE.MathUtils.smoothstep(ahead, this.depth - 6, this.depth - 1));
      if (!item.data.hidden) item.uniforms.uFade.value = fade;
    }
  }
}

export type RoomKind = "space" | "tunnel" | "spacetunnel";

export function createRoom(kind: RoomKind, host: HTMLElement, pictures: RoomPicture[], options: RoomOptions): RoomScene {
  if (kind === "tunnel") return new TunnelRoom(host, pictures, options);
  if (kind === "spacetunnel") return new SpaceTunnelRoom(host, pictures, options);
  return new SpaceRoom(host, pictures, options);
}
