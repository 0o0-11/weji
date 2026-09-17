export type DeviceTier = "high" | "low" | "none";

/**
 * How much 3D this device should get.
 *
 * "none" means no WebGL at all, so the preview falls back to a flat picture
 * grid. "low" is for devices that report little memory or few cores, or have
 * data saving switched on: fewer pictures, softer rendering, no colour split.
 * Everything else gets the full bloom. The scene also measures its own frame
 * rate once running and softens itself further if it struggles, so a device
 * that is misjudged here still ends up smooth.
 */
export function detectTier(): DeviceTier {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "none";
    // Release the probe context immediately; browsers cap how many can exist.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    return "none";
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  if (memory <= 3 || cores <= 4 || nav.connection?.saveData) return "low";
  return "high";
}
