import * as THREE from "three";

/**
 * Loads pictures into GPU textures without stalling the animation.
 *
 * Each picture is downloaded and shrunk off the main thread
 * (createImageBitmap), then handed to the GPU a few per frame, so a room of a
 * hundred-odd pictures fills in smoothly instead of freezing while it loads.
 */
export class PictureLoader {
  private generation = 0;
  private queue: { index: number; url: string; generation: number }[] = [];
  private active = 0;
  private ready: { index: number; bitmap: ImageBitmap; generation: number }[] = [];
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly maxSide: number,
    private readonly onTexture: (index: number, texture: THREE.Texture) => void,
    private readonly concurrency = 8,
  ) {}

  /** Forget anything still loading and start on these, in order. */
  fill(entries: { index: number; url: string }[]) {
    this.generation += 1;
    this.queue = entries.map((entry) => ({ ...entry, generation: this.generation }));
    for (const item of this.ready) item.bitmap.close();
    this.ready = [];
    this.pump();
  }

  /** Hand a few finished pictures to the GPU. Called once per frame. */
  upload(maxPerFrame: number) {
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    let count = 0;
    while (this.ready.length > 0 && count < maxPerFrame) {
      const item = this.ready.shift()!;
      if (item.generation !== this.generation) {
        item.bitmap.close();
        continue;
      }
      const texture = new THREE.Texture(item.bitmap as unknown as HTMLImageElement);
      texture.flipY = false; // already flipped while decoding
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
      this.renderer.initTexture(texture);
      item.bitmap.close();
      this.onTexture(item.index, texture);
      count += 1;
    }
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    for (const item of this.ready) item.bitmap.close();
    this.ready = [];
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.active += 1;
      void this.decode(job.url)
        .then((bitmap) => {
          if (!bitmap) return;
          if (this.disposed || job.generation !== this.generation) {
            bitmap.close();
            return;
          }
          this.ready.push({ index: job.index, bitmap, generation: job.generation });
        })
        .finally(() => {
          this.active -= 1;
          if (!this.disposed) this.pump();
        });
    }
  }

  private async decode(url: string): Promise<ImageBitmap | null> {
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!response.ok) return null;
      const original = await createImageBitmap(await response.blob());
      const scale = Math.min(1, this.maxSide / Math.max(original.width, original.height));
      const resized = await createImageBitmap(original, {
        resizeWidth: Math.max(1, Math.round(original.width * scale)),
        resizeHeight: Math.max(1, Math.round(original.height * scale)),
        resizeQuality: "high",
        imageOrientation: "flipY",
      });
      original.close();
      return resized;
    } catch {
      return null;
    }
  }
}
