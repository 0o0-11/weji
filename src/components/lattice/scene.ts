import * as THREE from "three";
import { Atlas } from "./atlas";
import {
  backdropFragment,
  backdropVertex,
  latticeFragment,
  latticeVertex,
  photoFragment,
  postFragment,
  screenVertex,
} from "./shaders";

/**
 * The WEJI star lattice: the visitor stands inside a ring of pictures cut into
 * eight-point stars, with glass crosses between them — the star-and-cross
 * tiling of Islamic geometric art, turned into a room.
 *
 * Scrolling turns the room, the pointer raises a lens of stars toward you,
 * a search sends a glass star across the view and turns every picture over,
 * and opening a picture unfolds its star into a full-screen frame while the
 * rest of the room falls away.
 */

export interface LatticePicture {
  id: string;
  thumb: string;
  full: string;
  color: string;
  width: number;
  height: number;
}

export type LatticeTier = "high" | "low";

/** Smooth scrolling, owned by the page (Lenis) and read by the scene every frame. */
export interface ScrollDriver {
  raf(timeMs: number): void;
  /** Scroll position in whole turns of the ring. Unbounded; only the fraction matters. */
  turns(): number;
  stop(): void;
  start(): void;
}

export interface LatticeOptions {
  tier: LatticeTier;
  reducedMotion: boolean;
  /** 1 for left-to-right reading, -1 for Arabic: the room turns the way the language reads. */
  direction: 1 | -1;
  scroll: ScrollDriver | null;
  onOpen: (pictureIndex: number) => void;
  /** The picture has started folding back into the room. */
  onClosing: () => void;
  onClosed: () => void;
  /** The visitor turned the room for the first time. */
  onFirstTurn: () => void;
}

type Phase = "entering" | "idle" | "flipping" | "opening" | "open" | "closing";

interface Tween {
  from: number;
  to: number;
  start: number;
  duration: number;
  ease: (t: number) => number;
  apply: (value: number) => void;
  done?: () => void;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const linear = (t: number) => t;

const RADIUS = 10;
const TAU = Math.PI * 2;

function layoutFor(tier: LatticeTier, aspect: number) {
  const portrait = aspect < 0.9;
  const rows = portrait ? (tier === "high" ? 7 : 6) : tier === "high" ? 5 : 4;
  const cols = portrait ? (tier === "high" ? 34 : 26) : tier === "high" ? 48 : 40;
  return { rows, cols, portrait, cell: (TAU * RADIUS) / cols };
}

function parseColor(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return [0.1, 0.09, 0.14];
  const value = parseInt(match[1], 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function starDistance(x: number, y: number) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return Math.min((ax + ay - 0.5) * Math.SQRT1_2, Math.max(ax, ay) - 0.5 * Math.SQRT1_2);
}

export class LatticeScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene = new THREE.Scene();
  private readonly screenScene = new THREE.Scene();
  private readonly photoScene = new THREE.Scene();
  private readonly screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly raycaster = new THREE.Raycaster();

  private readonly rows: number;
  private readonly cols: number;
  private readonly cell: number;
  private readonly portrait: boolean;
  private readonly camZ = RADIUS * 0.3;

  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly backdrop: THREE.ShaderMaterial;
  private readonly post: THREE.ShaderMaterial | null;
  private readonly photo: THREE.ShaderMaterial;
  private renderTarget: THREE.WebGLRenderTarget | null;

  private front: Atlas;
  private back: Atlas | null = null;
  private readonly atlasSize: number;
  private readonly slotPx: number;

  /** Star instances in the order pictures fill them: front and centre first. */
  private readonly starOrder: number[] = [];
  private readonly starAt = new Map<string, number>();
  private readonly instanceCount: number;
  private pictureCount = { front: 0, back: 0 };
  private backLoadedEarly = 0;
  private pictures: LatticePicture[];
  private pendingPictures: LatticePicture[] = [];

  private phase: Phase = "entering";
  private tweens: Tween[] = [];
  private raf = 0;
  private startTime = performance.now();
  private time = 0;
  private lastFrame = performance.now();
  private disposed = false;

  private rotation = 0;
  private previousRotation = 0;
  private entranceRotation = 0;
  private dragRotation = 0;
  private dragVelocity = 0;
  private drift = 0;
  private velocity = 0;
  private turnedByVisitor = false;
  private lastInput = { turns: 0, drag: 0 };
  private cameraOffset = 0;
  private idleSince = 0;

  private pointer: { x: number; y: number; inside: boolean; type: string } = { x: 0, y: 0, inside: false, type: "mouse" };
  private press: { x: number; y: number; time: number; id: number; dragging: boolean; lastX: number } | null = null;
  private lensStrength = 0;
  private hoverCell: { col: number; row: number } | null = null;
  private tint = new THREE.Vector3(0.5, 0.4, 0.6);
  private tintTarget = new THREE.Vector3(0.5, 0.4, 0.6);

  private flipPending: { since: number; needed: number } | null = null;
  private openState: { col: number; row: number; aspect: number; token: number; texture: THREE.Texture | null } | null = null;
  private openToken = 0;
  private readonly blankTexture = new THREE.DataTexture(new Uint8Array([10, 9, 18, 255]), 1, 1);

  private frameTimes: number[] = [];
  private pixelRatioCap: number;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    initialPictures: LatticePicture[],
    private readonly options: LatticeOptions,
  ) {
    const { tier } = options;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const layout = layoutFor(tier, width / height);
    this.rows = layout.rows;
    this.cols = layout.cols;
    this.cell = layout.cell;
    this.portrait = layout.portrait;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.pixelRatioCap = tier === "high" ? 2 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x07060d, 1);
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const maxTexture = this.renderer.capabilities.maxTextureSize;
    this.atlasSize = tier === "high" && maxTexture >= 4096 ? 4096 : 2048;
    this.slotPx = this.atlasSize === 4096 ? 256 : 128;

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 120);
    this.camera.position.set(0, 0, this.camZ);
    this.camera.lookAt(0, 0, -RADIUS);

    this.front = this.makeAtlas();

    // ── Instances: stars on every grid point, crosses between them.
    const segments = tier === "high" ? 10 : 6;
    const plane = new THREE.PlaneGeometry(1, 1, segments, segments);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = plane.index;
    this.geometry.setAttribute("position", plane.getAttribute("position"));
    this.geometry.setAttribute("uv", plane.getAttribute("uv"));

    const stars = this.rows * this.cols;
    const crosses = (this.rows - 1) * this.cols;
    this.instanceCount = stars + crosses;
    const cells = new Float32Array(this.instanceCount * 3);
    const rand = new Float32Array(this.instanceCount);
    let index = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        cells.set([col, row, 0], index * 3);
        rand[index] = Math.random();
        this.starAt.set(`${col}:${row}`, index);
        index++;
      }
    }
    for (let row = 0; row < this.rows - 1; row++) {
      for (let col = 0; col < this.cols; col++) {
        cells.set([col + 0.5, row + 0.5, 1], index * 3);
        rand[index] = Math.random();
        index++;
      }
    }

    // Pictures fill the column straight ahead first, then spread left and right,
    // middle rows before edge rows — the best results are where you look first.
    const middle = (this.rows - 1) / 2;
    const rowOrder = [...Array(this.rows).keys()].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
    for (let k = 0; k < this.cols; k++) {
      const offset = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * options.direction;
      const col = ((offset % this.cols) + this.cols) % this.cols;
      for (const row of rowOrder) this.starOrder.push(this.starAt.get(`${col}:${row}`)!);
    }

    const filled = (size: number, value: number) => new Float32Array(this.instanceCount * size).fill(value);
    this.geometry.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 3));
    this.geometry.setAttribute("aRand", new THREE.InstancedBufferAttribute(rand, 1));
    this.geometry.setAttribute("aSlot", new THREE.InstancedBufferAttribute(filled(2, -1), 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aLoaded", new THREE.InstancedBufferAttribute(filled(2, -1), 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aColorA", new THREE.InstancedBufferAttribute(filled(3, 0.1), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aColorB", new THREE.InstancedBufferAttribute(filled(3, 0.1), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.instanceCount = this.instanceCount;

    const originRow = Math.floor(middle);
    this.material = new THREE.ShaderMaterial({
      vertexShader: latticeVertex,
      fragmentShader: latticeFragment,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uRot: { value: 0 },
        uRadius: { value: RADIUS },
        uCell: { value: this.cell },
        uRows: { value: this.rows },
        uCols: { value: this.cols },
        uVel: { value: 0 },
        uGrow: { value: 0 },
        uOrigin: { value: new THREE.Vector2(0, originRow) },
        uFlip: { value: 0 },
        uFlipOrigin: { value: new THREE.Vector2(0, originRow) },
        uFall: { value: 0 },
        uOpenCell: { value: new THREE.Vector2(-99, -99) },
        uLens: { value: new THREE.Vector3(0, 0, 0) },
        uHoverA: { value: new THREE.Vector3(-99, -99, 0) },
        uHoverB: { value: new THREE.Vector3(-99, -99, 0) },
        uMotion: { value: options.reducedMotion ? 0 : 1 },
        uAtlasA: { value: this.front.texture },
        uAtlasB: { value: this.front.texture },
        uPerRow: { value: this.front.perRow },
        uSlotPx: { value: this.slotPx },
        uTint: { value: this.tint },
      },
    });
    const lattice = new THREE.Mesh(this.geometry, this.material);
    lattice.frustumCulled = false;
    this.scene.add(lattice);

    const screenQuad = new THREE.PlaneGeometry(2, 2);
    this.backdrop = new THREE.ShaderMaterial({
      vertexShader: backdropVertex,
      fragmentShader: backdropFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRes: { value: new THREE.Vector2(width, height) },
        uTime: { value: 0 },
        uRot: { value: 0 },
        uTint: { value: this.tint },
        uFade: { value: 0 },
      },
    });
    const backdrop = new THREE.Mesh(screenQuad, this.backdrop);
    backdrop.frustumCulled = false;
    backdrop.renderOrder = -1;
    this.scene.add(backdrop);

    // Strong devices render the room to a texture first, so the glass star can bend it.
    if (tier === "high") {
      this.renderTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: true });
      this.post = new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        fragmentShader: postFragment,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tScene: { value: this.renderTarget.texture },
          uRes: { value: new THREE.Vector2(width, height) },
          uTime: { value: 0 },
          uVel: { value: 0 },
          uSweep: { value: 0 },
          uSweepSize: { value: this.portrait ? 0.3 : 0.46 },
        },
      });
      const postQuad = new THREE.Mesh(screenQuad, this.post);
      postQuad.frustumCulled = false;
      this.screenScene.add(postQuad);
    } else {
      this.renderTarget = null;
      this.post = null;
    }

    this.photo = new THREE.ShaderMaterial({
      vertexShader: screenVertex,
      fragmentShader: photoFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPhoto: { value: this.blankTexture },
        uAtlas: { value: this.front.texture },
        uSlot: { value: 0 },
        uPerRow: { value: this.front.perRow },
        uSlotPx: { value: this.slotPx },
        uPhotoReady: { value: 0 },
        uOpen: { value: 0 },
        uRes: { value: new THREE.Vector2(width, height) },
        uStart: { value: new THREE.Vector3() },
        uRect: { value: new THREE.Vector4() },
        uPhotoAspect: { value: 1 },
        uTime: { value: 0 },
        uPixel: { value: 1 },
      },
    });
    this.blankTexture.needsUpdate = true;
    const photoQuad = new THREE.Mesh(screenQuad, this.photo);
    photoQuad.frustumCulled = false;
    this.photoScene.add(photoQuad);

    this.pictures = initialPictures;
    this.assignPictures(initialPictures, "front");

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.startEntrance();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Turn every picture over to a new set, behind a sweeping glass star. */
  showResults(pictures: LatticePicture[]) {
    if (pictures.length === 0) return;
    if (this.phase === "opening" || this.phase === "open" || this.phase === "closing") return;
    if (this.phase === "flipping") this.completeFlip();
    if (this.phase === "entering") this.finishEntrance();

    if (!this.back) {
      this.back = this.makeAtlas();
      this.material.uniforms.uAtlasB.value = this.back.texture;
    }
    this.pendingPictures = pictures;
    this.backLoadedEarly = 0;
    this.assignPictures(pictures, "back");
    this.phase = "flipping";
    this.flipPending = { since: this.time, needed: Math.min(this.pictureCount.back, this.rows * 6) };
  }

  /** Fold the open picture back into its star. */
  close() {
    if (!this.openState || (this.phase !== "open" && this.phase !== "opening")) return;
    this.phase = "closing";
    this.options.onClosing();
    this.tweens = this.tweens.filter((tween) => tween.apply !== this.setOpen && tween.apply !== this.setFall);
    const quick = this.options.reducedMotion;
    this.tween(this.photo.uniforms.uOpen.value, 0, quick ? 0.2 : 0.85, easeInOutSine, this.setOpen);
    this.tween(this.material.uniforms.uFall.value, 0, quick ? 0.2 : 1.0, easeOutCubic, this.setFall, () => {
      const texture = this.openState?.texture;
      this.photo.uniforms.uPhoto.value = this.blankTexture;
      texture?.dispose();
      this.openState = null;
      this.material.uniforms.uOpenCell.value.set(-99, -99);
      this.phase = "idle";
      this.idleSince = this.time;
      this.options.scroll?.start();
      this.options.onClosed();
    });
  }

  /** Development only: where a picture's star currently is, in CSS pixels. */
  debugStar(pictureIndex: number) {
    const instance = this.starOrder[pictureIndex];
    const cells = this.geometry.getAttribute("aCell") as THREE.InstancedBufferAttribute;
    const col = cells.getX(instance);
    const row = cells.getY(instance);
    const point = this.starScreen(col, row, 0);
    const ratio = this.renderer.getPixelRatio();
    const canvasHeight = this.renderer.domElement.height;
    return { x: point.x / ratio, y: (canvasHeight - point.y) / ratio, visible: point.visible, phase: this.phase };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.openState?.texture?.dispose();
    this.front.dispose();
    this.back?.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.backdrop.dispose();
    this.post?.dispose();
    this.photo.dispose();
    this.blankTexture.dispose();
    this.renderTarget?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  // ── Pictures ──────────────────────────────────────────────────────────────

  private makeAtlas(): Atlas {
    const atlas: Atlas = new Atlas(this.renderer, this.atlasSize, this.slotPx, (slot) => this.onSlotLoaded(atlas, slot));
    return atlas;
  }

  private assignPictures(pictures: LatticePicture[], side: "front" | "back") {
    const atlas = side === "front" ? this.front : this.back!;
    const count = Math.min(pictures.length, atlas.capacity);
    this.pictureCount[side] = count;
    const slots = this.geometry.getAttribute("aSlot") as THREE.InstancedBufferAttribute;
    const loaded = this.geometry.getAttribute("aLoaded") as THREE.InstancedBufferAttribute;
    const colors = this.geometry.getAttribute(side === "front" ? "aColorA" : "aColorB") as THREE.InstancedBufferAttribute;
    const component = side === "front" ? 0 : 1;

    this.starOrder.forEach((instance, order) => {
      const slot = count > 0 ? order % count : -1;
      slots.setComponent(instance, component, slot);
      loaded.setComponent(instance, component, -1);
      const [r, g, b] = parseColor(pictures[slot]?.color ?? "#1a1826");
      colors.setXYZ(instance, r, g, b);
    });
    slots.needsUpdate = true;
    loaded.needsUpdate = true;
    colors.needsUpdate = true;

    this.setTintFrom(pictures);
    atlas.fill(pictures.slice(0, count).map((picture) => picture.thumb));
  }

  private onSlotLoaded(atlas: Atlas, slot: number) {
    const component = atlas === this.front ? 0 : atlas === this.back ? 1 : -1;
    if (component < 0) return;
    const slots = this.geometry.getAttribute("aSlot") as THREE.InstancedBufferAttribute;
    const loaded = this.geometry.getAttribute("aLoaded") as THREE.InstancedBufferAttribute;
    for (let instance = 0; instance < this.rows * this.cols; instance++) {
      if (slots.getComponent(instance, component) === slot) loaded.setComponent(instance, component, this.time);
    }
    loaded.needsUpdate = true;
    if (component === 1 && this.flipPending && slot < this.flipPending.needed) this.backLoadedEarly += 1;
  }

  private setTintFrom(pictures: LatticePicture[]) {
    const sample = pictures.slice(0, 16);
    if (sample.length === 0) return;
    const sum = [0, 0, 0];
    for (const picture of sample) {
      const [r, g, b] = parseColor(picture.color);
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
    }
    const color = new THREE.Color(sum[0] / sample.length, sum[1] / sample.length, sum[2] / sample.length);
    // Keep the hue, but lift it so even a dark set of pictures colours the room.
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    color.setHSL(hsl.h, Math.min(1, hsl.s * 0.8 + 0.35), 0.55);
    this.tintTarget.set(color.r, color.g, color.b);
  }

  // ── Transitions ───────────────────────────────────────────────────────────

  private startEntrance() {
    const uniforms = this.material.uniforms;
    const maxDistance = Math.hypot(this.cols / 2, this.rows) + 2;
    if (this.options.reducedMotion) {
      uniforms.uGrow.value = maxDistance;
      this.backdrop.uniforms.uFade.value = 1;
      this.phase = "idle";
      return;
    }
    this.entranceRotation = 0.3 * this.options.direction;
    this.cameraOffset = 6;
    this.tween(0, 1, 0.9, easeOutCubic, (v) => (this.backdrop.uniforms.uFade.value = v));
    this.tween(0.3 * this.options.direction, 0, 3.4, easeOutCubic, (v) => (this.entranceRotation = v));
    this.tween(6, 0, 3.6, easeOutCubic, (v) => (this.cameraOffset = v));
    // One star draws itself in light, holds a breath, then the pattern grows outward.
    this.tween(0, 1.7, 1.0, easeOutCubic, (v) => (uniforms.uGrow.value = v), () => {
      this.tween(1.7, maxDistance, 2.6, (t) => t * t, (v) => (uniforms.uGrow.value = v), () => {
        if (this.phase === "entering") this.phase = "idle";
        this.idleSince = this.time;
      });
    });
  }

  private finishEntrance() {
    this.tweens = [];
    this.material.uniforms.uGrow.value = Math.hypot(this.cols / 2, this.rows) + 2;
    this.backdrop.uniforms.uFade.value = 1;
    this.entranceRotation = 0;
    this.cameraOffset = 0;
    this.phase = "idle";
  }

  private beginFlip() {
    this.flipPending = null;
    const uniforms = this.material.uniforms;
    const frontCol = (((Math.round((-this.rotation / TAU) * this.cols) % this.cols) + this.cols) % this.cols);
    uniforms.uFlipOrigin.value.set(frontCol, Math.floor((this.rows - 1) / 2));
    const maxDistance = Math.hypot(this.cols / 2, this.rows) + 2.5;

    if (this.options.reducedMotion) {
      this.completeFlip();
      return;
    }
    if (this.post) {
      this.tween(0, 1, 1.25, linear, (v) => (this.post!.uniforms.uSweep.value = v), () => {
        this.post!.uniforms.uSweep.value = 0;
      });
    }
    const delay = this.post ? 0.35 : 0;
    this.after(delay, () => {
      this.tween(0, maxDistance, 2.3, easeInOutSine, (v) => (uniforms.uFlip.value = v), () => this.completeFlip());
    });
  }

  /** The back set is now fully showing: make it the front set. */
  private completeFlip() {
    this.tweens = this.tweens.filter((tween) => tween.apply === this.setOpen);
    if (this.post) this.post.uniforms.uSweep.value = 0;
    if (!this.back) return;
    const slots = this.geometry.getAttribute("aSlot") as THREE.InstancedBufferAttribute;
    const loaded = this.geometry.getAttribute("aLoaded") as THREE.InstancedBufferAttribute;
    const colorsA = this.geometry.getAttribute("aColorA") as THREE.InstancedBufferAttribute;
    const colorsB = this.geometry.getAttribute("aColorB") as THREE.InstancedBufferAttribute;
    for (let i = 0; i < this.instanceCount; i++) {
      slots.setXY(i, slots.getY(i), -1);
      loaded.setXY(i, loaded.getY(i), -1);
      colorsA.setXYZ(i, colorsB.getX(i), colorsB.getY(i), colorsB.getZ(i));
    }
    slots.needsUpdate = true;
    loaded.needsUpdate = true;
    colorsA.needsUpdate = true;

    const previousFront = this.front;
    this.front = this.back;
    this.back = previousFront;
    this.pictureCount = { front: this.pictureCount.back, back: 0 };
    this.pictures = this.pendingPictures;
    this.material.uniforms.uAtlasA.value = this.front.texture;
    this.material.uniforms.uAtlasB.value = this.back.texture;
    this.material.uniforms.uFlip.value = 0;
    this.flipPending = null;
    this.phase = "idle";
    this.idleSince = this.time;
  }

  private readonly setOpen = (value: number) => {
    this.photo.uniforms.uOpen.value = value;
  };

  private readonly setFall = (value: number) => {
    this.material.uniforms.uFall.value = value;
  };

  private openStar(col: number, row: number) {
    if (this.phase !== "idle") return;
    const instance = this.starAt.get(`${col}:${row}`);
    if (instance === undefined) return;
    const slots = this.geometry.getAttribute("aSlot") as THREE.InstancedBufferAttribute;
    const slot = slots.getX(instance);
    const picture = this.pictures[slot];
    if (slot < 0 || !picture) return;

    const hover = this.hoverCell && this.hoverCell.col === col && this.hoverCell.row === row ? this.material.uniforms.uHoverA.value.z : 0;
    const start = this.starScreen(col, row, hover);
    const aspect = picture.width > 0 && picture.height > 0 ? picture.width / picture.height : 1;
    const token = ++this.openToken;
    this.openState = { col, row, aspect, token, texture: null };

    const uniforms = this.photo.uniforms;
    uniforms.uAtlas.value = this.front.texture;
    uniforms.uSlot.value = slot;
    uniforms.uPhotoAspect.value = aspect;
    uniforms.uPhotoReady.value = 0;
    uniforms.uPhoto.value = this.blankTexture;
    uniforms.uStart.value.set(start.x, start.y, start.radius);
    this.updatePhotoRect();
    this.material.uniforms.uOpenCell.value.set(col, row);
    this.hoverCell = null;
    this.material.uniforms.uHoverA.value.z = 0;
    this.material.uniforms.uHoverB.value.z = 0;

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(picture.full, (texture) => {
      if (this.disposed || this.openState?.token !== token) {
        texture.dispose();
        return;
      }
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      this.openState.texture = texture;
      uniforms.uPhoto.value = texture;
      this.tween(0, 1, 0.45, easeOutCubic, (v) => (uniforms.uPhotoReady.value = v));
    });

    this.phase = "opening";
    this.options.scroll?.stop();
    this.dragVelocity = 0;
    const quick = this.options.reducedMotion;
    this.tween(0, 1, quick ? 0.2 : 1.15, linear, this.setOpen, () => {
      if (this.phase === "opening") this.phase = "open";
    });
    this.tween(0, 1, quick ? 0.2 : 1.3, linear, this.setFall);
    this.options.onOpen(slot);
  }

  /** Where the opened picture's frame sits: as large as fits between the header and the info bar. */
  private updatePhotoRect() {
    if (!this.openState) return;
    const ratio = this.renderer.getPixelRatio();
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    const top = this.portrait ? 64 : 76;
    const bottom = this.portrait ? 200 : 136;
    const side = this.portrait ? 14 : 32;
    const boxW = Math.max(40, width - side * 2);
    const boxH = Math.max(40, height - top - bottom);
    const aspect = this.openState.aspect;
    let w = boxW;
    let h = w / aspect;
    if (h > boxH) {
      h = boxH;
      w = h * aspect;
    }
    const centreX = width / 2;
    const centreYFromTop = top + boxH / 2;
    this.photo.uniforms.uRect.value.set(centreX * ratio, (height - centreYFromTop) * ratio, (w / 2) * ratio, (h / 2) * ratio);
  }

  /** A star's centre and tip radius on screen, in device pixels with y pointing up. */
  private starScreen(col: number, row: number, hover: number) {
    const theta = (col / this.cols) * TAU + this.rotation;
    const radius = RADIUS - 0.55 * hover * this.cell;
    const y = ((this.rows - 1) / 2 - row) * this.cell;
    const centre = new THREE.Vector3(Math.sin(theta) * radius, y, -Math.cos(theta) * radius);
    const tip = centre.clone().add(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).multiplyScalar(this.cell * 0.5 * (1 + 0.2 * hover)));
    const canvas = this.renderer.domElement;
    const toScreen = (point: THREE.Vector3) => {
      const projected = point.clone().project(this.camera);
      return { x: ((projected.x + 1) / 2) * canvas.width, y: ((projected.y + 1) / 2) * canvas.height, z: projected.z };
    };
    const a = toScreen(centre);
    const b = toScreen(tip);
    return { x: a.x, y: a.y, radius: Math.hypot(b.x - a.x, b.y - a.y), visible: a.z < 1 && Math.cos(theta) > 0 };
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private pick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    const a = direction.x * direction.x + direction.z * direction.z;
    const b = 2 * (origin.x * direction.x + origin.z * direction.z);
    const c = origin.x * origin.x + origin.z * origin.z - RADIUS * RADIUS;
    const t = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
    const hit = origin.clone().add(direction.clone().multiplyScalar(t));
    const theta = Math.atan2(hit.x, -hit.z);
    const colF = ((((theta - this.rotation) / TAU) * this.cols) % this.cols + this.cols) % this.cols;
    const rowF = (this.rows - 1) / 2 - hit.y / this.cell;

    const col = Math.round(colF) % this.cols;
    const row = Math.round(rowF);
    let star: { col: number; row: number } | null = null;
    if (row >= 0 && row < this.rows) {
      let dx = colF - Math.round(colF);
      if (dx > 0.5) dx -= 1;
      if (starDistance(dx, rowF - row) < 0) star = { col, row };
    }
    return { colF, rowF, star };
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointer = { x: event.clientX, y: event.clientY, inside: true, type: event.pointerType };
    this.press = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId, dragging: false, lastX: event.clientX };
    this.idleSince = this.time;
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    this.pointer = { x: event.clientX, y: event.clientY, inside: true, type: event.pointerType };
    this.idleSince = this.time;
    const press = this.press;
    if (!press || press.id !== event.pointerId) return;
    // Touch turns the room through smooth scrolling; mouse and pen drag it directly.
    if (event.pointerType === "touch") return;
    if (!press.dragging && Math.abs(event.clientX - press.x) > 6) {
      press.dragging = true;
      this.renderer.domElement.setPointerCapture(event.pointerId);
      this.renderer.domElement.style.cursor = "grabbing";
    }
    if (press.dragging && this.phase !== "opening" && this.phase !== "open" && this.phase !== "closing") {
      const delta = (event.clientX - press.lastX) * this.radiansPerPixel();
      this.dragRotation += delta;
      this.dragVelocity = delta;
    }
    press.lastX = event.clientX;
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const press = this.press;
    this.press = null;
    if (!press || press.id !== event.pointerId) return;
    if (press.dragging) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
      this.renderer.domElement.style.cursor = "";
      return;
    }
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (moved > 8 || performance.now() - press.time > 600) return;
    if (this.phase === "open") {
      this.close();
      return;
    }
    if (this.phase === "entering") this.finishEntrance();
    const hit = this.pick(event.clientX, event.clientY);
    if (hit.star) this.openStar(hit.star.col, hit.star.row);
  };

  private readonly onPointerCancel = () => {
    this.press = null;
    this.renderer.domElement.style.cursor = "";
  };

  private readonly onPointerLeave = () => {
    this.pointer.inside = false;
  };

  /** How far the ring turns per pixel dragged, so a picture stays under the pointer. */
  private radiansPerPixel() {
    const height = this.host.clientHeight;
    const distance = RADIUS + this.camZ;
    const cellPixels = (this.cell / distance / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * (height / 2);
    return TAU / this.cols / Math.max(1, cellPixels);
  }

  // ── Frame loop ────────────────────────────────────────────────────────────

  private tween(from: number, to: number, duration: number, ease: (t: number) => number, apply: (value: number) => void, done?: () => void) {
    this.tweens.push({ from, to, start: this.time, duration: Math.max(0.001, duration), ease, apply, done });
    apply(from);
  }

  private after(seconds: number, callback: () => void) {
    this.tweens.push({ from: 0, to: 0, start: this.time, duration: Math.max(0.001, seconds), ease: linear, apply: () => {}, done: callback });
  }

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    this.step(now);
  };

  /**
   * Development only: advance and draw one frame by hand, then return it as an
   * image. Automated checks run in a hidden browser, where animation frames pause.
   */
  debugFrame(now: number, capture = false): string | null {
    this.step(now);
    return capture ? this.renderer.domElement.toDataURL("image/jpeg", 0.8) : null;
  }

  /** Development only: act as if the visitor clicked at this point. */
  debugClick(clientX: number, clientY: number) {
    const hit = this.pick(clientX, clientY);
    if (hit.star) this.openStar(hit.star.col, hit.star.row);
    return hit;
  }

  private step(now: number) {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time = (now - this.startTime) / 1000;

    this.options.scroll?.raf(now);

    // Tweens (a finished tween's callback may start new ones).
    const running = this.tweens;
    this.tweens = [];
    const keep: Tween[] = [];
    const finished: Tween[] = [];
    for (const tween of running) {
      const t = Math.min(1, (this.time - tween.start) / tween.duration);
      tween.apply(tween.from + (tween.to - tween.from) * tween.ease(t));
      if (t >= 1) finished.push(tween);
      else keep.push(tween);
    }
    this.tweens = keep.concat(this.tweens);
    for (const tween of finished) tween.done?.();

    this.front.upload(6);
    this.back?.upload(6);

    if (this.flipPending) {
      const { since, needed } = this.flipPending;
      if (this.backLoadedEarly >= needed * 0.7 || this.time - since > 1.1) this.beginFlip();
    }

    this.updateRotation(dt);
    this.updatePointer(dt);

    this.tint.lerp(this.tintTarget, 1 - Math.exp(-dt * 1.5));

    const uniforms = this.material.uniforms;
    uniforms.uTime.value = this.time;
    uniforms.uRot.value = this.rotation;
    uniforms.uVel.value = this.options.reducedMotion ? 0 : this.velocity;
    this.backdrop.uniforms.uTime.value = this.time;
    this.backdrop.uniforms.uRot.value = this.rotation;
    this.photo.uniforms.uTime.value = this.time;

    this.camera.position.z = this.camZ + this.cameraOffset;

    if (this.post && this.renderTarget) {
      this.post.uniforms.uTime.value = this.time;
      this.post.uniforms.uVel.value = this.velocity;
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.screenScene, this.screenCamera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.photo.uniforms.uOpen.value > 0.0001) {
      this.renderer.autoClear = false;
      this.renderer.render(this.photoScene, this.screenCamera);
      this.renderer.autoClear = true;
    }

    this.watchPerformance(dt);
  }

  private updateRotation(dt: number) {
    const frozen = this.phase === "opening" || this.phase === "open" || this.phase === "closing";
    if (!frozen && !this.press?.dragging) {
      // Let a flung drag glide to a stop.
      this.dragRotation += this.dragVelocity;
      this.dragVelocity *= Math.exp(-dt * 3.2);
      if (Math.abs(this.dragVelocity) < 1e-5) this.dragVelocity = 0;
    }

    // When nobody is touching anything, the room drifts slowly on its own.
    if (!frozen && !this.options.reducedMotion) {
      const idle = Math.min(1, Math.max(0, (this.time - this.idleSince - 3) / 2));
      this.drift -= dt * 0.018 * idle * this.options.direction;
    }

    const scrollTurns = this.options.scroll?.turns() ?? 0;
    if (!this.turnedByVisitor && this.time > 0.5) {
      const moved = Math.abs(scrollTurns - this.lastInput.turns) > 0.004 || Math.abs(this.dragRotation - this.lastInput.drag) > 0.02;
      if (moved && !frozen) {
        this.turnedByVisitor = true;
        this.options.onFirstTurn();
      }
    } else if (!this.turnedByVisitor) {
      this.lastInput = { turns: scrollTurns, drag: this.dragRotation };
    }
    const target = -this.options.direction * scrollTurns * TAU + this.dragRotation + this.drift + this.entranceRotation;
    if (!frozen) this.rotation = target;

    let delta = this.rotation - this.previousRotation;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.previousRotation = this.rotation;
    const columnsPerSecond = dt > 0 ? delta / dt / (TAU / this.cols) : 0;
    const targetVelocity = Math.max(-1, Math.min(1, columnsPerSecond / 14));
    this.velocity += (targetVelocity - this.velocity) * (1 - Math.exp(-dt * 6));
    if (Math.abs(delta) > 1e-4) this.idleSince = this.time;
  }

  private updatePointer(dt: number) {
    const uniforms = this.material.uniforms;
    const interactive = (this.phase === "idle" || this.phase === "entering") && this.pointer.inside && this.pointer.type !== "touch";
    let lensTarget = 0;
    let hovered: { col: number; row: number } | null = null;

    if (interactive && !this.press?.dragging) {
      const hit = this.pick(this.pointer.x, this.pointer.y);
      const outside = Math.max(0, Math.abs(hit.rowF - (this.rows - 1) / 2) - (this.rows - 1) / 2);
      lensTarget = Math.max(0, 1 - outside);
      uniforms.uLens.value.x = hit.colF;
      uniforms.uLens.value.y = hit.rowF;
      hovered = hit.star;
    }
    this.lensStrength += (lensTarget - this.lensStrength) * (1 - Math.exp(-dt * 5));
    uniforms.uLens.value.z = this.options.reducedMotion ? 0 : this.lensStrength;

    const hoverA = uniforms.uHoverA.value as THREE.Vector3;
    const hoverB = uniforms.uHoverB.value as THREE.Vector3;
    const same = hovered && this.hoverCell && hovered.col === this.hoverCell.col && hovered.row === this.hoverCell.row;
    if (!same) {
      if (this.hoverCell) hoverB.set(hoverA.x, hoverA.y, hoverA.z);
      this.hoverCell = hovered;
      if (hovered) hoverA.set(hovered.col, hovered.row, 0);
      else hoverA.z = 0;
      this.renderer.domElement.style.cursor = hovered ? "pointer" : this.press?.dragging ? "grabbing" : "";
    }
    const ease = 1 - Math.exp(-dt * 9);
    hoverA.z += ((this.hoverCell ? 1 : 0) - hoverA.z) * ease;
    hoverB.z += (0 - hoverB.z) * ease;
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    const ratio = this.renderer.getPixelRatio();
    this.camera.aspect = width / height;

    // Fit the band of stars to about two thirds of the screen height.
    const band = this.rows * this.cell;
    const fill = this.portrait ? 0.6 : 0.64;
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(band / fill / 2 / (RADIUS + this.camZ)));
    this.camera.updateProjectionMatrix();

    const pixelWidth = Math.floor(width * ratio);
    const pixelHeight = Math.floor(height * ratio);
    this.renderTarget?.setSize(pixelWidth, pixelHeight);
    this.backdrop.uniforms.uRes.value.set(pixelWidth, pixelHeight);
    this.post?.uniforms.uRes.value.set(pixelWidth, pixelHeight);
    this.photo.uniforms.uRes.value.set(pixelWidth, pixelHeight);
    this.photo.uniforms.uPixel.value = ratio;
    this.updatePhotoRect();
  }

  /** If this device can't keep up, give up the most expensive effects first. */
  private watchPerformance(dt: number) {
    if (this.time < 4) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 120) return;
    const average = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (average < 1 / 42) return;
    if (this.pixelRatioCap > 1) {
      this.pixelRatioCap = Math.max(1, this.pixelRatioCap - 0.5);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
      this.resize();
    }
  }
}
