import * as THREE from "three";

/**
 * One big texture holding many small square pictures.
 *
 * Drawing hundreds of pictures as hundreds of textures would cost hundreds of
 * draw calls; packing them into one texture lets the whole lattice draw in one.
 * Each picture is fetched, centre-cropped and shrunk off the main thread
 * (createImageBitmap), then copied into its slot on the GPU. Nothing is
 * re-uploaded except that one square.
 */
export class Atlas {
  readonly texture: THREE.DataTexture;
  readonly perRow: number;
  readonly capacity: number;

  /** Bumped on every reset, so pictures still downloading for an old search are ignored. */
  private generation = 0;
  private queue: { slot: number; url: string; generation: number }[] = [];
  private active = 0;
  private ready: { slot: number; bitmap: ImageBitmap; generation: number }[] = [];
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    readonly size: number,
    readonly slotPx: number,
    private readonly onLoaded: (slot: number) => void,
    private readonly concurrency = 8,
  ) {
    this.perRow = Math.floor(size / slotPx);
    this.capacity = this.perRow * this.perRow;

    // Allocated on the GPU only: there is no CPU copy of this texture at all.
    this.texture = new THREE.DataTexture(null, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.source.dataReady = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.flipY = false;
    this.texture.needsUpdate = true;
    renderer.initTexture(this.texture);
  }

  /** Forget every slot and start filling from the given pictures, in order. */
  fill(urls: string[]) {
    this.generation += 1;
    this.queue = urls.slice(0, this.capacity).map((url, slot) => ({ slot, url, generation: this.generation }));
    for (const item of this.ready) item.bitmap.close();
    this.ready = [];
    this.pump();
  }

  /** Copy a few finished pictures to the GPU. Called once per frame to spread the work. */
  upload(maxPerFrame: number) {
    let count = 0;
    while (this.ready.length > 0 && count < maxPerFrame) {
      const item = this.ready.shift()!;
      if (item.generation === this.generation) {
        const source = new THREE.Texture(item.bitmap as unknown as HTMLImageElement);
        const col = item.slot % this.perRow;
        const row = Math.floor(item.slot / this.perRow);
        this.renderer.copyTextureToTexture(source, this.texture, null, new THREE.Vector2(col * this.slotPx, row * this.slotPx));
        this.onLoaded(item.slot);
        count += 1;
      }
      item.bitmap.close();
    }
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    for (const item of this.ready) item.bitmap.close();
    this.ready = [];
    this.texture.dispose();
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.active += 1;
      void this.fetchSquare(job.url)
        .then((bitmap) => {
          if (!bitmap) return;
          if (this.disposed || job.generation !== this.generation) {
            bitmap.close();
            return;
          }
          this.ready.push({ slot: job.slot, bitmap, generation: job.generation });
        })
        .finally(() => {
          this.active -= 1;
          if (!this.disposed) this.pump();
        });
    }
  }

  private async fetchSquare(url: string): Promise<ImageBitmap | null> {
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!response.ok) return null;
      const blob = await response.blob();
      const image = await createImageBitmap(blob);
      const side = Math.min(image.width, image.height);
      const square = await createImageBitmap(
        image,
        Math.floor((image.width - side) / 2),
        Math.floor((image.height - side) / 2),
        side,
        side,
        { resizeWidth: this.slotPx, resizeHeight: this.slotPx, resizeQuality: "high" },
      );
      image.close();
      return square;
    } catch {
      return null;
    }
  }
}
