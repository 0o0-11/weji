import * as THREE from "three";
import { backdropFragment, backdropVertex, coreFragment, coreVertex, tileFragment, tileVertex } from "./shaders";

/**
 * The WEJI bloom: pictures arranged as an eight-fold rosette in depth that
 * unfolds from a point of light, spins under the hand, bends with its own
 * speed, and opens a picture by flying it toward the viewer.
 *
 * Written against three.js directly rather than a React wrapper. The scene is
 * one self-contained animation loop; driving it imperatively keeps every frame
 * off React's render path, and avoids tying WEJI's React version to a renderer
 * library's release cycle.
 */

export interface BloomPicture {
  id: string;
  thumb: string;
  color: string;
  width: number;
  height: number;
}

export type BloomTier = "high" | "low";

export interface BloomOptions {
  tier: BloomTier;
  reducedMotion: boolean;
  /** A picture was opened; the index is into the current picture list. */
  onOpen: (pictureIndex: number) => void;
  /** The opened picture finished flying back into the bloom. */
  onClosed: () => void;
}

type Phase = "blooming" | "idle" | "collapsing" | "opening" | "open" | "closing";

interface Tile {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
  fromPosition: THREE.Vector3;
  fromScale: number;
  delay: number;
  hover: number;
  texMixTarget: number;
  texture: THREE.Texture | null;
  loadToken: number;
}

interface Portal {
  tile: Tile;
  tileIndex: number;
  fromPosition: THREE.Vector3;
  fromQuaternion: THREE.Quaternion;
  toPosition: THREE.Vector3;
  toQuaternion: THREE.Quaternion;
  toScale: number;
}

const TILE_W = 1.55;
const TILE_H = 2.05;
/** Tiles per ring. Eight-fold symmetry throughout: 8, 16, 24. */
const RINGS: Record<BloomTier, number[]> = { high: [8, 16, 24], low: [8, 16] };
// Wide spacing between rings keeps the rosette reading as a flower, and leaves
// a calm core for the wordmark.
const RING_RADII = [4.1, 7.0, 9.9];
/** Every tile turns to face this point, which bowls the rosette like a flower. */
const FOCUS = new THREE.Vector3(0, 0, 12);
const ORIGIN = new THREE.Vector3(0, 0, -4);

const BLOOM_TILE_SECONDS = 1.15;
const COLLAPSE_SECONDS = 0.6;
const PORTAL_SECONDS = 0.9;
const AUTO_SPIN = 0.07; // radians per second

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Frame-rate-independent easing toward a target. */
const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export class BloomScene {
  private readonly container: HTMLElement;
  private readonly options: BloomOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private readonly rosette = new THREE.Group();
  private readonly loader = new THREE.TextureLoader();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly placeholder: THREE.DataTexture;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly backdrop: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly core: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly tiles: Tile[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly maxAnisotropy: number;

  private pictures: BloomPicture[] = [];
  private pendingPictures: BloomPicture[] | null = null;
  private phase: Phase = "blooming";
  private phaseStart = 0;
  private portal: Portal | null = null;

  private spin = 0;
  private velocity = 0;
  private bend = 0;
  private allowSplit: boolean;
  private hovered = -1;
  private pointerInside = false;

  private dragging = false;
  private dragMoved = 0;
  private dragStartTime = 0;
  private lastAngle = 0;
  private lastMoveTime = 0;

  private readonly tint = new THREE.Color("#07060d");
  private readonly tintTarget = new THREE.Color("#07060d");
  private tintMix = 0;

  private perfSamples: number[] = [];
  private perfChecked = false;
  private lastFrame = 0;
  private now = 0;
  private raf = 0;
  private disposed = false;

  constructor(container: HTMLElement, pictures: BloomPicture[], options: BloomOptions) {
    this.container = container;
    this.options = options;
    this.allowSplit = options.tier === "high" && !options.reducedMotion;

    this.renderer = new THREE.WebGLRenderer({
      antialias: options.tier === "high",
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.tier === "high" ? 2 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor("#07060d");
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none;cursor:grab";
    container.appendChild(canvas);
    this.maxAnisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    this.loader.setCrossOrigin("anonymous");
    this.placeholder = new THREE.DataTexture(new Uint8Array([22, 20, 34, 255]), 1, 1);
    this.placeholder.needsUpdate = true;

    // Backdrop: a screen-space quad drawn before everything else.
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: backdropVertex,
        fragmentShader: backdropFragment,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uTint: { value: this.tint },
          uTintMix: { value: 0 },
        },
      }),
    );
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -10;
    this.scene.add(this.backdrop);

    // The point of light the rosette opens from.
    this.core = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.ShaderMaterial({
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uIntensity: { value: 0 } },
      }),
    );
    this.core.position.set(0, 0, -2.5);
    this.core.renderOrder = -5;
    this.scene.add(this.core);

    // One shared, finely divided plane: the curl happens in the vertex shader.
    const segments = options.tier === "high" ? 24 : 10;
    this.geometry = new THREE.PlaneGeometry(TILE_W, TILE_H, segments, Math.round(segments * 1.3));
    this.buildTiles();
    this.scene.add(this.rosette);

    this.camera.position.set(0, 0, 20);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.applyPictures(pictures);
    this.startPhase("blooming");
    this.raf = requestAnimationFrame(this.frame);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Fold the current pictures into the light, then bloom again with new ones. */
  rebloom(pictures: BloomPicture[]) {
    if (pictures.length === 0 || this.portal) return;
    this.pendingPictures = pictures;
    for (const tile of this.tiles) {
      tile.fromPosition.copy(tile.mesh.position);
      tile.fromScale = tile.mesh.scale.x;
    }
    this.startPhase("collapsing");
  }

  /** Send the opened picture back into the rosette. */
  closePortal() {
    if (!this.portal || (this.phase !== "open" && this.phase !== "opening")) return;
    this.startPhase("closing");
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("wheel", this.onWheel);
    for (const tile of this.tiles) {
      tile.texture?.dispose();
      tile.mesh.material.dispose();
    }
    this.geometry.dispose();
    this.placeholder.dispose();
    this.backdrop.geometry.dispose();
    this.backdrop.material.dispose();
    this.core.geometry.dispose();
    this.core.material.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  // ── Construction ────────────────────────────────────────────────────────

  private buildTiles() {
    const dummy = new THREE.Object3D();
    RINGS[this.options.tier].forEach((count, ringIndex) => {
      const radius = RING_RADII[ringIndex];
      const depth = (-0.22 * radius * radius) / 3;
      // Alternate rings are offset by half a step, so tiles interlock like petals.
      const offset = ringIndex % 2 === 1 ? Math.PI / count : 0;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + offset + Math.PI / 2;
        const homePosition = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, depth);
        dummy.position.copy(homePosition);
        dummy.lookAt(FOCUS);

        const material = new THREE.ShaderMaterial({
          vertexShader: tileVertex,
          fragmentShader: tileFragment,
          transparent: true,
          uniforms: {
            uTex: { value: this.placeholder },
            uTexMix: { value: 0 },
            uPlane: { value: new THREE.Vector2(TILE_W, TILE_H) },
            uImage: { value: new THREE.Vector2(3, 4) },
            uColor: { value: new THREE.Color("#1b1826") },
            uAlpha: { value: 0 },
            uHover: { value: 0 },
            uSplit: { value: 0 },
            uBend: { value: 0 },
            uTime: { value: 0 },
            uRadius: { value: 0.12 },
          },
        });

        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.userData.tileIndex = this.tiles.length;
        mesh.position.copy(ORIGIN);
        mesh.scale.setScalar(0.0001);
        this.rosette.add(mesh);

        this.tiles.push({
          mesh,
          homePosition,
          homeQuaternion: dummy.quaternion.clone(),
          fromPosition: new THREE.Vector3(),
          fromScale: 1,
          delay: 0.12 + ringIndex * 0.24 + (i / count) * 0.42,
          hover: 0,
          texMixTarget: 0,
          texture: null,
          loadToken: 0,
        });
      }
    });
  }

  private applyPictures(pictures: BloomPicture[]) {
    this.pictures = pictures;
    this.tiles.forEach((tile, index) => {
      const picture = pictures[index % pictures.length];
      if (!picture) return;
      const uniforms = tile.mesh.material.uniforms;
      uniforms.uColor.value.set(picture.color || "#1b1826");
      uniforms.uImage.value.set(picture.width || 3, picture.height || 4);
      uniforms.uTexMix.value = 0;
      tile.texMixTarget = 0;

      const token = ++tile.loadToken;
      this.loader.load(
        picture.thumb,
        (texture) => {
          // A newer rebloom may have replaced this tile's picture while loading.
          if (this.disposed || token !== tile.loadToken) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = this.maxAnisotropy;
          tile.texture?.dispose();
          tile.texture = texture;
          uniforms.uTex.value = texture;
          const image = texture.image as { width: number; height: number };
          uniforms.uImage.value.set(image.width, image.height);
          tile.texMixTarget = 1;
        },
        undefined,
        () => {
          // Unreachable or blocked image: the tile keeps its average colour.
        },
      );
    });
  }

  // ── Loop ────────────────────────────────────────────────────────────────

  private startPhase(phase: Phase) {
    this.phase = phase;
    this.phaseStart = this.now;
  }

  private frame = (ms: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);

    const now = ms / 1000;
    const dt = this.lastFrame === 0 ? 1 / 60 : Math.min(0.05, now - this.lastFrame);
    // The very first frame has no real phase start yet; anchor it here.
    if (this.lastFrame === 0) this.phaseStart = now;
    this.lastFrame = now;
    this.now = now;
    const elapsed = now - this.phaseStart;

    switch (this.phase) {
      case "blooming":
        this.updateBloom(elapsed);
        break;
      case "collapsing":
        this.updateCollapse(elapsed);
        break;
      case "opening":
      case "open":
      case "closing":
        this.updatePortal(elapsed);
        break;
      default:
        break;
    }

    this.updateMotion(dt);
    this.updateHover(dt);
    this.updateTint(dt);

    const backdropUniforms = this.backdrop.material.uniforms;
    backdropUniforms.uTime.value = now;
    backdropUniforms.uTintMix.value = this.tintMix;

    this.renderer.render(this.scene, this.camera);
    this.checkPerformance(dt);
  };

  private updateBloom(elapsed: number) {
    const { reducedMotion } = this.options;
    let finished = true;

    for (const tile of this.tiles) {
      const delay = reducedMotion ? 0 : tile.delay;
      const duration = reducedMotion ? 0.5 : BLOOM_TILE_SECONDS;
      const local = clamp01((elapsed - delay) / duration);
      if (local < 1) finished = false;
      const settle = easeOutCubic(local);

      tile.mesh.position.lerpVectors(reducedMotion ? tile.homePosition : ORIGIN, tile.homePosition, settle);
      tile.mesh.quaternion.copy(tile.homeQuaternion);
      tile.mesh.scale.setScalar(Math.max(0.0001, reducedMotion ? 1 : easeOutBack(local)));
      tile.mesh.material.uniforms.uAlpha.value = clamp01(local * 3);
    }

    // The whole rosette unwinds as it opens, so the bloom spirals out.
    const unwind = reducedMotion ? 0 : -1.4 * (1 - easeOutCubic(clamp01(elapsed / 2.8)));
    this.rosette.rotation.z = this.spin + unwind;

    // A flash at the moment of opening, settling into a steady glow.
    const flash = reducedMotion
      ? 0.4
      : elapsed < 0.4
        ? (elapsed / 0.4) * 2.4
        : 0.45 + 1.95 * Math.exp(-(elapsed - 0.4) * 1.6);
    this.core.material.uniforms.uIntensity.value = flash;

    if (finished) this.startPhase("idle");
  }

  private updateCollapse(elapsed: number) {
    const t = clamp01(elapsed / COLLAPSE_SECONDS);
    const e = easeInOutCubic(t);
    for (const tile of this.tiles) {
      tile.mesh.position.lerpVectors(tile.fromPosition, ORIGIN, e);
      tile.mesh.scale.setScalar(Math.max(0.0001, tile.fromScale * (1 - e)));
      tile.mesh.material.uniforms.uAlpha.value = 1 - e;
    }
    // Folding in whips the rosette around.
    if (!this.options.reducedMotion) this.velocity = 5 * (1 - t);
    this.core.material.uniforms.uIntensity.value = 0.45 + 1.6 * e;

    if (t >= 1 && this.pendingPictures) {
      this.applyPictures(this.pendingPictures);
      this.pendingPictures = null;
      this.velocity = 0;
      this.startPhase("blooming");
    }
  }

  private updatePortal(elapsed: number) {
    const portal = this.portal;
    if (!portal) return;
    const t = clamp01(elapsed / PORTAL_SECONDS);
    const e = easeInOutCubic(t);
    const v = this.phase === "closing" ? 1 - e : this.phase === "open" ? 1 : e;

    const mesh = portal.tile.mesh;
    mesh.position.lerpVectors(portal.fromPosition, portal.toPosition, v);
    mesh.quaternion.slerpQuaternions(portal.fromQuaternion, portal.toQuaternion, v);
    mesh.scale.setScalar(1 + (portal.toScale - 1) * v);
    // The card curls mid-flight and lands flat.
    mesh.material.uniforms.uBend.value = Math.sin(v * Math.PI) * 0.7;
    mesh.material.uniforms.uHover.value = 0;

    for (const tile of this.tiles) {
      if (tile === portal.tile) continue;
      tile.mesh.material.uniforms.uAlpha.value = 1 - 0.85 * v;
    }
    this.core.material.uniforms.uIntensity.value = 0.45 * (1 - v);

    if (this.phase === "opening" && t >= 1) this.startPhase("open");
    if (this.phase === "closing" && t >= 1) {
      // Back into the rosette, at exactly its home transform.
      this.rosette.attach(mesh);
      mesh.position.copy(portal.tile.homePosition);
      mesh.quaternion.copy(portal.tile.homeQuaternion);
      mesh.scale.setScalar(1);
      mesh.material.uniforms.uBend.value = 0;
      for (const tile of this.tiles) tile.mesh.material.uniforms.uAlpha.value = 1;
      this.portal = null;
      this.startPhase("idle");
      this.options.onClosed();
    }
  }

  private updateMotion(dt: number) {
    const { reducedMotion } = this.options;
    const inPortal = this.portal !== null;

    if (!inPortal) {
      if (!this.dragging) {
        this.velocity *= Math.pow(0.12, dt);
        this.spin += ((reducedMotion ? 0 : AUTO_SPIN) + this.velocity) * dt;
      }
      if (this.phase !== "blooming") this.rosette.rotation.z = this.spin;

      // Lean the whole rosette gently toward the pointer.
      const leanX = reducedMotion ? 0 : -this.pointer.y * 0.14;
      const leanY = reducedMotion ? 0 : this.pointer.x * 0.2;
      this.rosette.rotation.x = damp(this.rosette.rotation.x, leanX, 4, dt);
      this.rosette.rotation.y = damp(this.rosette.rotation.y, leanY, 4, dt);

      // A slow breath.
      if (!reducedMotion) this.rosette.scale.setScalar(1 + Math.sin(this.now * 0.6) * 0.012);
    }

    const bendTarget = reducedMotion || inPortal ? 0 : Math.min(1, Math.abs(this.velocity) * 0.2);
    this.bend = damp(this.bend, bendTarget, 8, dt);
    const split = this.allowSplit && !inPortal ? Math.min(0.014, Math.abs(this.velocity) * 0.0035) : 0;

    for (const tile of this.tiles) {
      const uniforms = tile.mesh.material.uniforms;
      if (tile !== this.portal?.tile) uniforms.uBend.value = this.bend;
      uniforms.uSplit.value = split;
      uniforms.uTime.value = this.now;
      uniforms.uTexMix.value = damp(uniforms.uTexMix.value, tile.texMixTarget, 5, dt);
    }
  }

  private updateHover(dt: number) {
    let next = -1;
    if (this.phase === "idle" && this.pointerInside && !this.dragging) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(
        this.tiles.map((tile) => tile.mesh),
        false,
      )[0];
      if (hit) next = hit.object.userData.tileIndex as number;
    }
    if (next !== this.hovered) {
      this.hovered = next;
      if (!this.dragging) this.renderer.domElement.style.cursor = next >= 0 ? "pointer" : "grab";
    }

    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      if (tile === this.portal?.tile) continue;
      tile.hover = damp(tile.hover, i === this.hovered ? 1 : 0, 10, dt);
      tile.mesh.material.uniforms.uHover.value = tile.hover;
      if (this.phase === "idle") tile.mesh.scale.setScalar(1 + tile.hover * 0.07);
    }
  }

  private updateTint(dt: number) {
    let mixTarget = 0;
    if (this.portal && this.phase !== "closing") {
      this.tintTarget.set(this.pictureFor(this.portal.tileIndex)?.color || "#07060d");
      mixTarget = 1;
    } else if (this.hovered >= 0) {
      this.tintTarget.set(this.pictureFor(this.hovered)?.color || "#07060d");
      mixTarget = 0.4;
    }
    this.tint.lerp(this.tintTarget, 1 - Math.exp(-4 * dt));
    this.tintMix = damp(this.tintMix, mixTarget, 3, dt);
  }

  /**
   * If the device can't hold a smooth frame rate once the bloom settles, trade
   * sharpness for smoothness automatically. Motion that stutters reads as
   * broken; a slightly softer image doesn't.
   */
  private checkPerformance(dt: number) {
    if (this.perfChecked || this.phase !== "idle") return;
    this.perfSamples.push(dt);
    if (this.perfSamples.length < 90) return;
    const sorted = [...this.perfSamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median > 1 / 42) {
      this.renderer.setPixelRatio(1);
      this.allowSplit = false;
      this.resize();
    }
    this.perfChecked = true;
  }

  // ── Interaction ─────────────────────────────────────────────────────────

  private pictureFor(tileIndex: number) {
    return this.pictures.length ? this.pictures[tileIndex % this.pictures.length] : undefined;
  }

  private angleAt(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
  }

  private setPointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.portal) return;
    this.dragging = true;
    this.dragMoved = 0;
    this.dragStartTime = performance.now();
    this.lastAngle = this.angleAt(event);
    this.lastMoveTime = performance.now();
    this.velocity = 0;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private onPointerMove = (event: PointerEvent) => {
    this.pointerInside = true;
    this.setPointer(event);
    if (!this.dragging) return;

    const angle = this.angleAt(event);
    let delta = angle - this.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.lastAngle = angle;

    const nowMs = performance.now();
    const seconds = Math.max(0.008, (nowMs - this.lastMoveTime) / 1000);
    this.lastMoveTime = nowMs;

    // Screen y points down and world y points up, so a clockwise drag on
    // screen subtracts from the rosette's angle to turn it clockwise too.
    this.spin -= delta;
    this.velocity = this.velocity * 0.5 + (-delta / seconds) * 0.5;
    this.dragMoved += Math.abs(event.movementX) + Math.abs(event.movementY);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    // Release spin carries on only if the hand was still moving when it let go.
    if (performance.now() - this.lastMoveTime > 90) this.velocity = 0;
    this.velocity = Math.max(-9, Math.min(9, this.velocity));

    const wasClick = this.dragMoved < 6 && performance.now() - this.dragStartTime < 450;
    if (wasClick && this.phase === "idle") {
      this.setPointer(event);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(
        this.tiles.map((tile) => tile.mesh),
        false,
      )[0];
      if (hit) this.openTile(hit.object.userData.tileIndex as number);
    }
    this.renderer.domElement.style.cursor = this.hovered >= 0 ? "pointer" : "grab";
  };

  private onPointerLeave = () => {
    this.pointerInside = false;
    this.pointer.set(0, 0);
  };

  private onWheel = (event: WheelEvent) => {
    if (this.portal) return;
    this.velocity = Math.max(-9, Math.min(9, this.velocity + event.deltaY * 0.004));
  };

  private openTile(tileIndex: number) {
    const tile = this.tiles[tileIndex];
    if (!tile) return;

    // Lift the tile out of the rotating rosette into world space, keeping its
    // on-screen position, so it can fly straight at the camera.
    this.scene.attach(tile.mesh);

    const distance = 7;
    const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visibleWidth = visibleHeight * this.camera.aspect;

    this.portal = {
      tile,
      tileIndex,
      fromPosition: tile.mesh.position.clone(),
      fromQuaternion: tile.mesh.quaternion.clone(),
      toPosition: new THREE.Vector3(0, 0, this.camera.position.z - distance),
      toQuaternion: this.camera.quaternion.clone(),
      toScale: Math.min((visibleHeight * 0.64) / TILE_H, (visibleWidth * 0.8) / TILE_W),
    };
    tile.hover = 0;
    this.velocity = 0;
    this.hovered = -1;
    this.startPhase("opening");
    this.options.onOpen(tileIndex % Math.max(1, this.pictures.length));
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Portrait screens pull back so the rosette still reads as a flower.
    this.camera.position.z = this.camera.aspect < 1 ? 20 + (1 - this.camera.aspect) * 14 : 20;
    this.camera.updateProjectionMatrix();
    this.backdrop.material.uniforms.uRes.value.set(width, height);
  }
}
