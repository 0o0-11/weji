import * as THREE from "three";
import { aspectOf, RoomScene, seeded, type RoomItem, type RoomOptions, type RoomPicture } from "./RoomScene";

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
// 2. Curved wall: you stand inside a round gallery of whole pictures in rows,
//    and scrolling turns the wall around you.
// ─────────────────────────────────────────────────────────────────────────────

export class WallRoom extends RoomScene {
  private static readonly RADIUS = 16;
  private static readonly GAP = 0.18;
  private rows = 3;
  private rowHeight = 2.3;
  private rotation = 0;
  private look = 0;

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(30, 60);
  }

  protected capacity() {
    return this.tier === "high" ? 130 : 90;
  }

  protected layout(pictures: RoomPicture[]) {
    const R = WallRoom.RADIUS;
    const gap = WallRoom.GAP;
    const circumference = Math.PI * 2 * R;
    const portrait = this.camera.aspect < 0.9;
    this.rows = portrait ? 4 : 3;
    this.rowHeight = portrait ? 2.0 : 2.3;

    // Deal pictures into the shortest row until every row goes all the way round.
    const rows: { picture: RoomPicture; index: number; width: number }[][] = Array.from({ length: this.rows }, () => []);
    const lengths = new Array(this.rows).fill(0);
    for (let index = 0; index < pictures.length; index++) {
      const shortest = lengths.indexOf(Math.min(...lengths));
      if (lengths[shortest] >= circumference) break;
      const width = this.rowHeight * frameAspect(pictures[index]);
      rows[shortest].push({ picture: pictures[index], index, width });
      lengths[shortest] += width + gap;
    }

    rows.forEach((row, rowIndex) => {
      if (row.length === 0) return;
      // Stretch each row slightly so it closes into a seamless ring.
      const stretch = (circumference - gap * row.length) / (lengths[rowIndex] - gap * row.length);
      let along = rowIndex * 1.3; // stagger the rows like brickwork
      const y = ((this.rows - 1) / 2 - rowIndex) * (this.rowHeight + gap);
      for (const entry of row) {
        const width = entry.width * stretch;
        const theta = (along + width / 2) / R;
        along += width + gap;

        // Bend the picture to the curve of the wall.
        const geometry = new THREE.PlaneGeometry(width, this.rowHeight, Math.max(2, Math.ceil(width / 0.3)), 1);
        const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          positions.setXYZ(i, R * Math.sin(x / R), positions.getY(i), R - R * Math.cos(x / R));
        }
        geometry.computeBoundingSphere();

        const item = this.addItem(entry.index, entry.picture, geometry, width, this.rowHeight);
        item.data.theta = theta;
        item.mesh.position.set(R * Math.sin(theta), y, -R * Math.cos(theta));
        item.mesh.rotation.y = -theta;
      }
    });
  }

  protected loadOrder() {
    // Turning the room by r moves a picture from angle theta to theta - r.
    const front = (item: RoomItem) => Math.abs(Math.atan2(Math.sin(item.data.theta - this.rotation), Math.cos(item.data.theta - this.rotation)));
    return [...this.items].sort((a, b) => front(a) - front(b));
  }

  protected fitCamera(width: number, height: number) {
    const R = WallRoom.RADIUS;
    const cameraZ = R * 0.32;
    const band = this.rows * (this.rowHeight + WallRoom.GAP);
    const fill = width / height < 0.9 ? 0.66 : 0.74;
    this.camera.position.set(0, 0, cameraZ);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(band / fill / 2 / (R + cameraZ)));
  }

  protected update(dt: number, frozen: boolean) {
    if (frozen) return;
    const radiansPerPixel = 0.0022;
    // Scrolling down moves pictures to the left; dragging carries them with the pointer.
    this.rotation += this.scrollDelta * Math.PI * 2;
    this.rotation -= this.dragX * radiansPerPixel;
    if (!this.reducedMotion && this.idleFor > 3) this.rotation += dt * 0.012 * Math.min(1, (this.idleFor - 3) / 2);
    this.world.rotation.y = this.rotation;

    const target = this.reducedMotion || !this.pointerInside ? 0 : this.pointerNdc.x;
    this.look += (target - this.look) * (1 - Math.exp(-dt * 2));
    this.camera.rotation.set(0, -this.look * 0.06, 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tunnel: pictures line the walls, floor and ceiling of a long corridor,
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

export type RoomKind = "space" | "wall" | "tunnel";

export function createRoom(kind: RoomKind, host: HTMLElement, pictures: RoomPicture[], options: RoomOptions): RoomScene {
  if (kind === "wall") return new WallRoom(host, pictures, options);
  if (kind === "tunnel") return new TunnelRoom(host, pictures, options);
  return new SpaceRoom(host, pictures, options);
}
