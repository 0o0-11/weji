import * as THREE from "three";
import type { RoomKind } from "./kinds";
import { aspectOf, RoomScene, seeded, type RoomItem, type RoomOptions, type RoomPicture } from "./RoomScene";

/** Very wide banners and very tall posters get a calmer frame; the picture is cropped to fit it. */
const frameAspect = (picture: RoomPicture) => THREE.MathUtils.clamp(aspectOf(picture), 0.62, 1.6);

const easeTowards = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cinema carousel: one large picture in the middle, the others turned to
//    either side with a soft reflection on the floor. Scrolling slides the next
//    picture into the middle, and it settles there.
// ─────────────────────────────────────────────────────────────────────────────

export class CarouselRoom extends RoomScene {
  private static readonly HEIGHT = 4.2;
  private position = 0;
  private target: number | null = null;
  private lastCentre = -1;
  private look = 0;

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(18, 42);
  }

  protected capacity() {
    return this.tier === "high" ? 60 : 40;
  }

  protected textureSize() {
    return this.options.tier === "high" ? 1280 : 768;
  }

  // The middle picture is shown very large, so it gets the sharper version.
  protected textureUrl(picture: RoomPicture) {
    return this.options.tier === "high" ? picture.full : picture.thumb;
  }

  protected layout(pictures: RoomPicture[]) {
    this.lastCentre = -1;
    pictures.forEach((picture, index) => {
      const height = CarouselRoom.HEIGHT;
      const width = height * frameAspect(picture);
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.scale(width, height, 1);
      const item = this.addItem(index, picture, geometry, width, height);

      // Its mirror image on the glossy floor: the same picture, upside down, fading out.
      const source = item.mesh.material as THREE.ShaderMaterial;
      const reflection = new THREE.ShaderMaterial({
        vertexShader: source.vertexShader,
        fragmentShader: source.fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { ...item.uniforms, uReflection: { value: 1 } } as unknown as Record<string, THREE.IUniform>,
      });
      const mirror = new THREE.Mesh(geometry, reflection);
      mirror.scale.y = -1;
      mirror.position.y = -(height + 0.08);
      item.mesh.add(mirror);
      item.mesh.addEventListener("removed", () => reflection.dispose());
    });
  }

  protected loadOrder() {
    const n = this.items.length;
    const distance = (item: RoomItem) => Math.abs(THREE.MathUtils.euclideanModulo(item.index - this.position + n / 2, n) - n / 2);
    return [...this.items].sort((a, b) => distance(a) - distance(b));
  }

  protected fitCamera(width: number, height: number) {
    const portrait = width / height < 0.9;
    this.camera.fov = portrait ? 56 : 38;
    this.camera.position.set(0, portrait ? 0.3 : 0.55, portrait ? 13.5 : 12.5);
    this.camera.lookAt(0, -0.35, 0);
  }

  /** Tapping a side picture brings it to the middle; tapping the middle one opens it. */
  protected onPick(item: RoomItem) {
    const n = this.items.length;
    const offset = THREE.MathUtils.euclideanModulo(item.index - this.position + n / 2, n) - n / 2;
    if (Math.abs(offset) < 0.5) return false;
    this.target = this.position + offset;
    return true;
  }

  protected update(dt: number, frozen: boolean) {
    const n = this.items.length;
    if (n === 0) return;
    const portrait = this.camera.aspect < 0.9;

    if (!frozen) {
      // About one picture per notch of a mouse wheel.
      const moved = this.scrollDelta * 80 - this.dragX / 230;
      this.position += moved;
      if (moved !== 0) this.target = null;
      if (this.target !== null) {
        this.position += (this.target - this.position) * easeTowards(dt, 6);
        if (Math.abs(this.target - this.position) < 0.002) {
          this.position = this.target;
          this.target = null;
        }
      } else if (this.idleFor > 0.18) {
        // Settle on the nearest picture once the visitor lets go.
        this.position += (Math.round(this.position) - this.position) * easeTowards(dt, 7);
      }

      const lean = this.reducedMotion || !this.pointerInside ? 0 : this.pointerNdc.x;
      this.look += (lean - this.look) * easeTowards(dt, 2);
      this.camera.position.x = this.look * 0.6;
      this.camera.lookAt(this.look * 0.2, -0.35, 0);
    }

    // During a search the pictures slide sideways out of view and the new ones slide in.
    const display = this.position + this.warp * 0.25;
    const nearGap = portrait ? 2.6 : 4.1;
    const step = portrait ? 0.95 : 1.35;
    for (const item of this.items) {
      const d = THREE.MathUtils.euclideanModulo(item.index - display + n / 2, n) - n / 2;
      const a = Math.abs(d);
      const side = Math.sign(d);
      const near = Math.min(a, 1);
      const far = Math.max(a - 1, 0);
      item.mesh.position.set(side * (near * nearGap + far * step), 0, 0.9 * (1 - near) - near * 1.4 - far * 0.6);
      item.mesh.rotation.set(0, -side * near * 0.95, 0);
      item.mesh.scale.setScalar(1 + 0.12 * (1 - near));
      if (!item.data.hidden) item.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(a, 4.5, 6.5);
    }

    const centre = THREE.MathUtils.euclideanModulo(Math.round(display), n);
    if (centre !== this.lastCentre && this.warp === 0) {
      this.lastCentre = centre;
      this.options.onCentre?.(this.items[centre]?.index ?? centre);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Depth gallery: a wall of whole pictures in columns, leaning back into the
//    distance. Scrolling glides the wall; it shows the most pictures at once.
// ─────────────────────────────────────────────────────────────────────────────

export class GalleryRoom extends RoomScene {
  private static readonly GAP = 0.3;
  private columns = 5;
  private columnWidth = 3.2;
  private columnHeights: number[] = [];
  private offset = 0;
  private look = new THREE.Vector2();

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(20, 36);
  }

  protected capacity() {
    return this.tier === "high" ? 120 : 70;
  }

  protected layout(pictures: RoomPicture[]) {
    const portrait = this.camera.aspect < 0.9;
    this.columns = portrait ? 2 : 5;
    this.columnWidth = portrait ? 3.6 : 3.2;
    const tops = new Array(this.columns).fill(0);
    pictures.forEach((picture, index) => {
      const column = tops.indexOf(Math.min(...tops));
      const width = this.columnWidth;
      const height = width / frameAspect(picture);
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.scale(width, height, 1);
      const item = this.addItem(index, picture, geometry, width, height);
      item.data.column = column;
      item.data.top = tops[column];
      tops[column] += height + GalleryRoom.GAP;
    });
    // Each column loops, so the wall never ends.
    this.columnHeights = tops.map((top) => Math.max(top, 40));
  }

  protected loadOrder() {
    return [...this.items].sort((a, b) => a.data.top - b.data.top);
  }

  protected fitCamera(width: number, height: number) {
    const portrait = width / height < 0.9;
    this.camera.fov = portrait ? 62 : 48;
    this.camera.position.set(0, 0, portrait ? 15 : 17);
    this.camera.lookAt(0, 0.6, 0);
  }

  protected update(dt: number, frozen: boolean) {
    if (!frozen) {
      this.offset += this.scrollDelta * 70 - this.dragY * 0.02;
      if (!this.reducedMotion && this.idleFor > 3) this.offset += dt * 0.3 * Math.min(1, (this.idleFor - 3) / 2);
      const lean = this.reducedMotion || !this.pointerInside ? 0 : 1;
      this.look.x += (this.pointerNdc.x * lean - this.look.x) * easeTowards(dt, 2);
      this.look.y += (this.pointerNdc.y * lean - this.look.y) * easeTowards(dt, 2);
    }
    // The top of the wall leans away from you; the pointer tilts it gently.
    this.world.rotation.set(-0.3 + this.look.y * 0.03, this.look.x * 0.05, 0);
    this.world.position.set(0, -0.8, -1.5);

    const flown = this.offset + this.warp * 0.9;
    const spacing = this.columnWidth + GalleryRoom.GAP;
    for (const item of this.items) {
      const column = item.data.column;
      const length = this.columnHeights[column];
      const stagger = column % 2 === 1 ? 1.6 : 0;
      const y = THREE.MathUtils.euclideanModulo(-(item.data.top + item.height / 2) + flown + stagger + length / 2, length) - length / 2;
      item.mesh.position.set((column - (this.columns - 1) / 2) * spacing, y, 0);
      if (!item.data.hidden) item.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(Math.abs(y), 12, 15);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Floating gallery: large pictures hang in space at different depths, the
//    far ones softly out of focus. Scrolling drifts you forward, and pictures
//    part around you as you pass them.
// ─────────────────────────────────────────────────────────────────────────────

/** Where pictures sit across the view, as fractions of its half-width and half-height. */
const ANCHORS: [number, number][] = [
  [-0.46, 0.1], [0.48, -0.06], [-0.12, 0.66], [0.2, -0.66], [-0.86, -0.48], [0.84, 0.5], [0.88, -0.44], [-0.84, 0.54],
];

export class FloatingRoom extends RoomScene {
  private static readonly SPACING = 1.7;
  private static readonly AHEAD = 8;
  private static readonly REFERENCE = 14;
  private depth = 1;
  private travel = 0;
  private look = new THREE.Vector2();

  constructor(host: HTMLElement, pictures: RoomPicture[], options: RoomOptions) {
    super(host, pictures, options);
    this.shared.uFog.value.set(12, 38);
  }

  protected capacity() {
    return this.tier === "high" ? 72 : 48;
  }

  protected layout(pictures: RoomPicture[]) {
    const random = seeded(5);
    const portrait = this.camera.aspect < 0.9;
    this.depth = Math.max(40, pictures.length * FloatingRoom.SPACING);
    pictures.forEach((picture, index) => {
      const height = (portrait ? 2.4 : 3.0) * (0.9 + random() * 0.3);
      const width = height * frameAspect(picture);
      const geometry = new THREE.PlaneGeometry(1, 1);
      geometry.scale(width, height, 1);
      const item = this.addItem(index, picture, geometry, width, height);
      const [nx, ny] = ANCHORS[index % ANCHORS.length];
      item.data.nx = nx + (random() - 0.5) * 0.16;
      item.data.ny = ny + (random() - 0.5) * 0.16;
      item.data.distance = index * FloatingRoom.SPACING;
      item.uniforms.uDepthBlur.value = 1;
    });
  }

  protected loadOrder() {
    return [...this.items];
  }

  private baseFov() {
    return this.camera.aspect < 0.9 ? 68 : 54;
  }

  protected fitCamera() {
    this.camera.fov = this.baseFov();
  }

  protected update(dt: number, frozen: boolean) {
    const fov = this.baseFov();
    if (!frozen) {
      const step = this.scrollDelta * this.depth + (this.dragY - this.dragX) * 0.01;
      this.travel += step;
      if (!this.reducedMotion && this.idleFor > 2.5) this.travel += dt * 0.3 * Math.min(1, (this.idleFor - 2.5) / 2);
      const perSecond = dt > 0 ? Math.abs(step) / dt : 0;
      this.speed += (Math.min(1, perSecond / 40) - this.speed) * easeTowards(dt, 5);

      const lean = this.reducedMotion || !this.pointerInside ? 0 : 1;
      this.look.x += (this.pointerNdc.x * lean - this.look.x) * easeTowards(dt, 2.5);
      this.look.y += (this.pointerNdc.y * lean - this.look.y) * easeTowards(dt, 2.5);
      this.camera.position.set(this.look.x * 0.5, this.look.y * 0.35, 0);
      this.camera.rotation.set(this.look.y * 0.04, -this.look.x * 0.06, 0);
      const wanted = fov + (this.reducedMotion ? 0 : this.speed * 6);
      if (Math.abs(this.camera.fov - wanted) > 0.01) {
        this.camera.fov = wanted;
        this.camera.updateProjectionMatrix();
      }
    }

    // Positions are laid out as they would look from a set distance, so the
    // composition stays balanced; perspective spreads pictures apart as they near.
    const halfHeight = FloatingRoom.REFERENCE * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const halfWidth = halfHeight * this.camera.aspect;
    const flown = this.travel + this.warp;
    for (const item of this.items) {
      const ahead = THREE.MathUtils.euclideanModulo(item.data.distance - flown + FloatingRoom.AHEAD, this.depth);
      // Pictures part around you as they come close, so none ever fills the screen.
      const part = 1 + 5 / Math.max(ahead, 1.5);
      item.mesh.position.set(item.data.nx * halfWidth * 0.52 * part, item.data.ny * halfHeight * 0.5 * part, -ahead + 2);
      const fade = THREE.MathUtils.smoothstep(ahead, 3, 8) * (1 - THREE.MathUtils.smoothstep(ahead, this.depth - 8, this.depth - 1));
      if (!item.data.hidden) item.uniforms.uFade.value = fade;
    }
  }
}

export function createRoom(kind: RoomKind, host: HTMLElement, pictures: RoomPicture[], options: RoomOptions): RoomScene {
  if (kind === "gallery") return new GalleryRoom(host, pictures, options);
  if (kind === "floating") return new FloatingRoom(host, pictures, options);
  return new CarouselRoom(host, pictures, options);
}
