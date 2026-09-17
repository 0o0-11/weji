import * as THREE from "three";
import { createPictureMaterial, createShared, type PictureUniforms, type SharedUniforms } from "./material";
import { PictureLoader } from "./pictures";

/**
 * Everything the three room demos share: the renderer, loading pictures,
 * pointing, clicking, and opening a picture. Each room only decides where its
 * pictures sit and how scrolling moves you through them.
 */

export interface RoomPicture {
  id: string;
  thumb: string;
  full: string;
  color: string;
  width: number;
  height: number;
}

export type RoomTier = "high" | "low";

/** Smooth scrolling, owned by the page (Lenis) and read by the room every frame. */
export interface ScrollDriver {
  raf(timeMs: number): void;
  /** Scroll position in "turns". Unbounded; one turn is one full lap of the room. */
  turns(): number;
  stop(): void;
  start(): void;
}

export interface RoomOptions {
  tier: RoomTier;
  reducedMotion: boolean;
  scroll: ScrollDriver | null;
  onOpen: (pictureIndex: number) => void;
  onClosing: () => void;
  onClosed: () => void;
}

export interface RoomItem {
  index: number;
  picture: RoomPicture;
  mesh: THREE.Mesh;
  uniforms: PictureUniforms;
  width: number;
  height: number;
  /** Anything the room wants to remember about where this picture lives. */
  data: Record<string, number>;
}

type Phase = "idle" | "opening" | "open" | "closing";

interface Tween {
  from: number;
  to: number;
  start: number;
  duration: number;
  ease: (t: number) => number;
  apply: (value: number) => void;
  done?: () => void;
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const BACKGROUND = new THREE.Color(0x09080e);

export function aspectOf(picture: RoomPicture) {
  return picture.width > 0 && picture.height > 0 ? picture.width / picture.height : 1.5;
}

export function parseColor(hex: string) {
  const color = new THREE.Color(0x1a1826);
  if (/^#[0-9a-f]{6}$/i.test(hex.trim())) color.set(hex.trim());
  return color;
}

/** Seeded random numbers, so a room is laid out the same way every visit. */
export function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export abstract class RoomScene {
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly camera: THREE.PerspectiveCamera;
  protected readonly scene = new THREE.Scene();
  protected readonly world = new THREE.Group();
  protected readonly shared: SharedUniforms;
  protected items: RoomItem[] = [];
  protected pictures: RoomPicture[] = [];
  protected readonly tier: RoomTier;
  protected readonly reducedMotion: boolean;

  protected time = 0;
  /** Scroll since last frame, in turns. */
  protected scrollDelta = 0;
  /** Mouse-drag since last frame, in pixels. */
  protected dragX = 0;
  protected dragY = 0;
  /** -1..1 across the screen. */
  protected pointerNdc = new THREE.Vector2();
  protected pointerInside = false;
  protected idleFor = 0;
  protected speed = 0;

  private readonly loader: PictureLoader;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private tweens: Tween[] = [];
  private raf = 0;
  private startTime = performance.now();
  private lastFrame = performance.now();
  private lastTurns: number | null = null;
  private disposed = false;
  private phase: Phase = "idle";
  private pointerType = "mouse";
  private press: { x: number; y: number; lastX: number; lastY: number; time: number; id: number; dragging: boolean } | null = null;
  private hovered: RoomItem | null = null;
  private focus: {
    item: RoomItem;
    mesh: THREE.Mesh;
    uniforms: PictureUniforms;
    from: { position: THREE.Vector3; quaternion: THREE.Quaternion; width: number; height: number };
    texture: THREE.Texture | null;
  } | null = null;
  private readonly focusShared: SharedUniforms;

  constructor(
    protected readonly host: HTMLElement,
    pictures: RoomPicture[],
    protected readonly options: RoomOptions,
  ) {
    this.tier = options.tier;
    this.reducedMotion = options.reducedMotion;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.tier === "high" ? 2 : 1.5));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(BACKGROUND, 1);
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 400);
    this.scene.add(this.world);

    this.shared = createShared(BACKGROUND);
    this.focusShared = { ...this.shared, uDim: { value: 0 }, uFog: { value: new THREE.Vector2(1e5, 1e5 + 1) } };

    this.loader = new PictureLoader(this.renderer, this.tier === "high" ? 640 : 384, (index, texture) => this.onTexture(index, texture));

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    // Subclasses finish their own setup before the first layout, so it runs on the next frame.
    queueMicrotask(() => {
      if (this.disposed) return;
      this.resize();
      this.setPictures(pictures);
      this.shared.uGlobal.value = 0;
      this.tween(0, 1, this.reducedMotion ? 0.01 : 1.2, easeOutCubic, (v) => (this.shared.uGlobal.value = v));
      this.raf = requestAnimationFrame(this.frame);
    });
  }

  // ── What each room provides ───────────────────────────────────────────────

  /** How many pictures this room holds on this device. */
  protected abstract capacity(): number;
  /** Create meshes for these pictures (via addItem) and position them. */
  protected abstract layout(pictures: RoomPicture[]): void;
  /** Move the camera and pictures for this frame. `frozen` while a picture is open. */
  protected abstract update(dt: number, frozen: boolean): void;
  /** Fit the camera to a new screen shape. */
  protected abstract fitCamera(width: number, height: number): void;
  /** Order to load pictures in: nearest to the viewer first. */
  protected abstract loadOrder(): RoomItem[];

  // ── Public API ────────────────────────────────────────────────────────────

  /** Swap in a new set of pictures: the room dims away and fills again. */
  showResults(pictures: RoomPicture[]) {
    if (pictures.length === 0 || this.phase !== "idle") return;
    const quick = this.reducedMotion;
    this.tween(this.shared.uGlobal.value, 0, quick ? 0.01 : 0.35, easeOutCubic, (v) => (this.shared.uGlobal.value = v), () => {
      this.setPictures(pictures);
      this.tween(0, 1, quick ? 0.01 : 0.9, easeOutCubic, (v) => (this.shared.uGlobal.value = v));
    });
  }

  close() {
    const focus = this.focus;
    if (!focus || (this.phase !== "open" && this.phase !== "opening")) return;
    this.phase = "closing";
    this.options.onClosing();
    this.tweens = this.tweens.filter((tween) => !tween.apply.name.startsWith("focus"));
    this.animateFocus(1, 0, this.reducedMotion ? 0.01 : 0.8, () => {
      this.world.remove(focus.mesh);
      this.scene.remove(focus.mesh);
      focus.mesh.geometry.dispose();
      (focus.mesh.material as THREE.Material).dispose();
      focus.texture?.dispose();
      focus.item.uniforms.uFade.value = 1;
      focus.item.data.hidden = 0;
      this.focus = null;
      this.phase = "idle";
      this.options.scroll?.start();
      this.options.onClosed();
    });
  }

  /** Development only: a picture's centre on screen in CSS pixels, and whether it faces the viewer. */
  debugItem(index: number) {
    const item = this.items[index];
    if (!item) return null;
    const point = item.mesh.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    return { x: ((point.x + 1) / 2) * width, y: ((1 - point.y) / 2) * height, visible: point.z < 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1 };
  }

  /** Development only: advance and draw one frame by hand (animation frames pause in a hidden browser). */
  debugFrame(now: number, capture = false) {
    this.step(now);
    return capture ? this.renderer.domElement.toDataURL("image/jpeg", 0.82) : null;
  }

  /** Development only: act as if the visitor clicked here. */
  debugClick(clientX: number, clientY: number) {
    this.click(clientX, clientY);
  }

  get lastFrameTime() {
    return this.lastFrame;
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
    this.loader.dispose();
    this.clearItems();
    if (this.focus) {
      this.focus.mesh.geometry.dispose();
      (this.focus.mesh.material as THREE.Material).dispose();
      this.focus.texture?.dispose();
    }
    this.renderer.dispose();
    canvas.remove();
  }

  // ── Helpers for rooms ─────────────────────────────────────────────────────

  protected addItem(index: number, picture: RoomPicture, geometry: THREE.BufferGeometry, width: number, height: number) {
    const { material, uniforms } = createPictureMaterial(this.shared, parseColor(picture.color), width, height, aspectOf(picture));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.index = index;
    this.world.add(mesh);
    const item: RoomItem = { index, picture, mesh, uniforms, width, height, data: {} };
    this.items.push(item);
    return item;
  }

  protected tween(from: number, to: number, duration: number, ease: (t: number) => number, apply: (value: number) => void, done?: () => void) {
    this.tweens.push({ from, to, start: this.time, duration: Math.max(0.001, duration), ease, apply, done });
    apply(from);
  }

  protected get isOpen() {
    return this.phase !== "idle";
  }

  // ── Pictures ──────────────────────────────────────────────────────────────

  private setPictures(pictures: RoomPicture[]) {
    this.clearItems();
    this.pictures = pictures.slice(0, this.capacity());
    this.layout(this.pictures);
    this.loader.fill(this.loadOrder().map((item) => ({ index: item.index, url: item.picture.thumb })));
  }

  private clearItems() {
    for (const item of this.items) {
      this.world.remove(item.mesh);
      item.mesh.geometry.dispose();
      (item.mesh.material as THREE.Material).dispose();
      item.uniforms.map.value?.dispose();
    }
    this.items = [];
    this.hovered = null;
  }

  private onTexture(index: number, texture: THREE.Texture) {
    const item = this.items.find((candidate) => candidate.index === index);
    if (!item) {
      texture.dispose();
      return;
    }
    item.uniforms.map.value = texture;
    item.uniforms.uHasMap.value = 1;
    item.uniforms.uLoadedAt.value = this.time;
  }

  // ── Opening a picture ─────────────────────────────────────────────────────

  private click(clientX: number, clientY: number) {
    if (this.phase === "open") {
      this.close();
      return;
    }
    if (this.phase !== "idle") return;
    const item = this.itemAt(clientX, clientY);
    if (item) this.open(item);
  }

  private open(item: RoomItem) {
    this.phase = "opening";
    this.options.scroll?.stop();
    this.world.updateMatrixWorld(true);

    const from = {
      position: item.mesh.getWorldPosition(new THREE.Vector3()),
      quaternion: item.mesh.getWorldQuaternion(new THREE.Quaternion()),
      width: item.width,
      height: item.height,
    };
    const shared = this.focusShared;
    const { material, uniforms } = createPictureMaterial(shared, parseColor(item.picture.color), item.width, item.height, aspectOf(item.picture));
    material.depthTest = false;
    uniforms.map.value = item.uniforms.map.value;
    uniforms.uHasMap.value = item.uniforms.uHasMap.value;
    uniforms.uLoadedAt.value = -10;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.renderOrder = 1000;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    item.uniforms.uFade.value = 0;
    item.data.hidden = 1;
    this.focus = { item, mesh, uniforms, from, texture: null };

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(item.picture.full, (texture) => {
      if (this.disposed || this.focus?.item !== item) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.focus.texture = texture;
      uniforms.map.value = texture;
      uniforms.uHasMap.value = 1;
      uniforms.uLoadedAt.value = -10;
    });

    this.animateFocus(0, 1, this.reducedMotion ? 0.01 : 0.95, () => {
      if (this.phase === "opening") this.phase = "open";
    });
    this.options.onOpen(item.index);
  }

  private animateFocus(from: number, to: number, duration: number, done: () => void) {
    const focusProgress = (value: number) => this.placeFocus(value);
    this.tween(from, to, duration, easeInOutCubic, focusProgress, done);
  }

  /** 0 = where the picture sits in the room, 1 = large and centred in front of the viewer. */
  private placeFocus(progress: number) {
    const focus = this.focus;
    if (!focus) return;
    const target = this.focusTarget(focus.item);
    const position = focus.from.position.clone().lerp(target.position, progress);
    // A slight arc toward the viewer, so the picture travels rather than slides.
    position.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion), Math.sin(progress * Math.PI) * 0.6);
    focus.mesh.position.copy(position);
    focus.mesh.quaternion.copy(focus.from.quaternion).slerp(target.quaternion, progress);
    const width = THREE.MathUtils.lerp(focus.from.width, target.width, progress);
    const height = THREE.MathUtils.lerp(focus.from.height, target.height, progress);
    focus.mesh.scale.set(width, height, 1);
    focus.uniforms.uSize.value.set(width, height);
    this.shared.uDim.value = progress;
  }

  private focusTarget(item: RoomItem) {
    const distance = 6;
    const portrait = this.camera.aspect < 0.9;
    const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visibleWidth = visibleHeight * this.camera.aspect;
    const aspect = THREE.MathUtils.clamp(aspectOf(item.picture), 0.3, 3.5);
    let height = visibleHeight * (portrait ? 0.6 : 0.7);
    let width = height * aspect;
    const maxWidth = visibleWidth * (portrait ? 0.92 : 0.82);
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspect;
    }
    this.camera.updateMatrixWorld();
    const position = new THREE.Vector3(0, visibleHeight * (portrait ? 0.07 : 0.06), -distance).applyMatrix4(this.camera.matrixWorld);
    const quaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
    return { position, quaternion, width, height };
  }

  // ── Pointer ───────────────────────────────────────────────────────────────

  private itemAt(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const visible = this.items.filter((item) => item.uniforms.uFade.value > 0.3 && !item.data.hidden).map((item) => item.mesh);
    const hit = this.raycaster.intersectObjects(visible, false)[0];
    if (!hit) return null;
    const depthFade = hit.distance > this.shared.uFog.value.y * 0.8;
    return depthFade ? null : (this.items.find((item) => item.mesh === hit.object) ?? null);
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointerType = event.pointerType;
    this.press = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, time: performance.now(), id: event.pointerId, dragging: false };
    this.idleFor = 0;
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    this.pointerType = event.pointerType;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.pointerInside = true;
    this.idleFor = 0;
    const press = this.press;
    if (!press || press.id !== event.pointerId || event.pointerType === "touch") return;
    if (!press.dragging && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) {
      press.dragging = true;
      this.renderer.domElement.setPointerCapture(event.pointerId);
      this.renderer.domElement.style.cursor = "grabbing";
    }
    if (press.dragging && this.phase === "idle") {
      this.dragX += event.clientX - press.lastX;
      this.dragY += event.clientY - press.lastY;
    }
    press.lastX = event.clientX;
    press.lastY = event.clientY;
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
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8 || performance.now() - press.time > 600) return;
    this.click(event.clientX, event.clientY);
  };

  private readonly onPointerCancel = () => {
    this.press = null;
    this.renderer.domElement.style.cursor = "";
  };

  private readonly onPointerLeave = () => {
    this.pointerInside = false;
  };

  // ── Frame loop ────────────────────────────────────────────────────────────

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    this.step(now);
  };

  private step(now: number) {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time = (now - this.startTime) / 1000;
    this.shared.uTime.value = this.time;
    this.idleFor += dt;

    const scroll = this.options.scroll;
    scroll?.raf(now);
    const turns = scroll?.turns() ?? 0;
    const delta = this.lastTurns === null ? 0 : turns - this.lastTurns;
    this.lastTurns = turns;
    // A jump of a whole lap is Lenis wrapping around, not the visitor scrolling.
    this.scrollDelta = Math.abs(delta) > 0.5 ? 0 : delta;
    if (this.scrollDelta !== 0) this.idleFor = 0;

    const running = this.tweens;
    this.tweens = [];
    const keep: Tween[] = [];
    const finished: Tween[] = [];
    for (const tween of running) {
      const t = Math.min(1, (this.time - tween.start) / tween.duration);
      tween.apply(tween.from + (tween.to - tween.from) * tween.ease(t));
      (t >= 1 ? finished : keep).push(tween);
    }
    this.tweens = keep.concat(this.tweens);
    for (const tween of finished) tween.done?.();

    this.loader.upload(this.tier === "high" ? 4 : 2);

    const frozen = this.phase !== "idle";
    this.update(dt, frozen);
    this.dragX = 0;
    this.dragY = 0;
    this.world.updateMatrixWorld(true);

    this.updateHover(dt, frozen);
    if (this.focus && this.phase !== "closing" && this.phase !== "opening") this.placeFocus(1);

    this.renderer.render(this.scene, this.camera);
  }

  private updateHover(dt: number, frozen: boolean) {
    let target: RoomItem | null = null;
    if (!frozen && this.pointerInside && this.pointerType !== "touch" && !this.press?.dragging) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hit = this.raycaster.intersectObjects(
        this.items.filter((item) => item.uniforms.uFade.value > 0.3 && !item.data.hidden).map((item) => item.mesh),
        false,
      )[0];
      if (hit && hit.distance < this.shared.uFog.value.y * 0.8) target = this.items.find((item) => item.mesh === hit.object) ?? null;
    }
    if (target !== this.hovered) {
      this.hovered = target;
      this.renderer.domElement.style.cursor = target ? "pointer" : "";
    }
    const ease = 1 - Math.exp(-dt * 10);
    for (const item of this.items) {
      const goal = item === this.hovered ? 1 : 0;
      item.uniforms.uHover.value += (goal - item.uniforms.uHover.value) * ease;
    }
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.fitCamera(width, height);
    // Centre the room in the space below the header, not the whole screen.
    const headerShift = Math.min(56, height * 0.06);
    this.camera.setViewOffset(width, height, 0, -headerShift, width, height);
    this.camera.updateProjectionMatrix();
  }
}
