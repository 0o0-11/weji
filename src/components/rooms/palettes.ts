/**
 * Colour themes for the space tunnel, for the owner to choose between.
 *
 * `ink` is the dark of space, `accent` colours buttons and the dust, and the
 * two glows are the soft light deep in the tunnel. Pictures always keep their
 * own colours; a theme only changes the space around them.
 */
export interface Palette {
  id: "gold" | "ocean" | "violet" | "dusk";
  ink: string;
  accent: string;
  glowA: string;
  glowB: string;
}

export const PALETTES: Palette[] = [
  { id: "gold", ink: "#09080e", accent: "#ffb23f", glowA: "#ffa640", glowB: "#ffd27a" },
  { id: "ocean", ink: "#04090f", accent: "#3de0d0", glowA: "#2fb6ff", glowB: "#3de0d0" },
  { id: "violet", ink: "#0a0613", accent: "#b69cff", glowA: "#8b6cff", glowB: "#ff5cc8" },
  { id: "dusk", ink: "#0f0907", accent: "#ff8a4c", glowA: "#ff7a3d", glowB: "#ffc36b" },
];

export const DEFAULT_PALETTE = PALETTES[0];
